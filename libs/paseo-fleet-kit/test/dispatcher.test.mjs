import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { BaseEventDispatcher } from "../src/index.js";

function createFakePaseo({ archived = [], missing = [], broken = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-kit-paseo-"));
  const calls = path.join(directory, "calls.json");
  const bin = path.join(directory, "paseo");
  fs.writeFileSync(
    bin,
    `#!/bin/sh\nif [ "$1" = inspect ]; then\n  ${broken ? 'echo "sh: paseo: command not found" >&2; exit 127' : ":"}\n  case " ${missing.join(" ")} " in *" $2 "*) echo '{"error":{"code":"AGENT_NOT_FOUND"}}'; exit 1;; esac\n  case " ${archived.join(" ")} " in *" $2 "*) echo '{"Archived":true}';; *) echo '{"Archived":false}';; esac\n  exit 0\nfi\nprintf '%s\\n' "$2" >> "${calls}"\nprintf '%s' "$3" >> "${calls}"\nprintf '\\n' >> "${calls}"\n`,
  );
  fs.chmodSync(bin, 0o755);
  return { bin, readCalls: () => fs.readFileSync(calls, "utf8").trim().split("\n") };
}

class TestDispatcher extends BaseEventDispatcher {
  shouldProcess(event) {
    return !event.noise;
  }

  buildPrompt(event) {
    return `prompt:${event.text}`;
  }

  buildEnvelope(event) {
    return { protocol: "paseo-fleet/v1", content: event.text };
  }
}

const registryWith = ({ subscriber = null, coordinator = null } = {}) => ({
  findMatchingAgent: () => subscriber,
  getCoordinator: () => coordinator,
});

describe("BaseEventDispatcher", () => {
  it("filters noise before anything is sent", async () => {
    const dispatcher = new TestDispatcher({ registry: registryWith({ coordinator: "c" }), config: {} });
    assert.deepEqual(await dispatcher.dispatch({ noise: true }), {
      routed: false,
      reason: "Filtered out as background noise",
    });
  });

  it("sends a plain prompt to the subscribed agent first", async () => {
    const paseo = createFakePaseo();
    const dispatcher = new TestDispatcher({
      registry: registryWith({ subscriber: "agent-s", coordinator: "agent-c" }),
      config: { paseoBin: paseo.bin },
    });
    const result = await dispatcher.dispatch({ text: "hi" });
    assert.equal(result.type, "specific_agent");
    assert.deepEqual(paseo.readCalls(), ["agent-s", "prompt:hi"]);
  });

  it("sends an envelope to the coordinator when no subscription matches", async () => {
    const paseo = createFakePaseo();
    const dispatcher = new TestDispatcher({
      registry: registryWith({ coordinator: "agent-c" }),
      config: { paseoBin: paseo.bin },
    });
    const result = await dispatcher.dispatch({ text: "hi" });
    assert.equal(result.type, "coordinator");
    assert.equal(result.envelope.content, "hi");
    assert.equal(paseo.readCalls()[0], "agent-c");
  });

  it("falls back to the config coordinator and then to an unrouted result", async () => {
    const fromConfig = new TestDispatcher({
      registry: registryWith(),
      config: { coordinatorAgentId: "cfg", paseoBin: "true" },
    });
    assert.equal(fromConfig.resolveCoordinatorId(), "cfg");

    const none = new TestDispatcher({ registry: registryWith(), config: {} });
    const result = await none.dispatch({ text: "hi" });
    assert.equal(result.routed, false);
    assert.equal(result.eventPrompt, "prompt:hi");
  });

  it("reports a failed delivery instead of throwing", async () => {
    const dispatcher = new TestDispatcher({
      registry: registryWith({ coordinator: "c" }),
      config: { paseoBin: "/nonexistent/paseo" },
    });
    const result = await dispatcher.dispatch({ text: "hi" });
    assert.equal(result.delivery.success, false);
  });

  it("drops the subscriptions of an archived agent and routes the event to the coordinator", async () => {
    const paseo = createFakePaseo({ archived: ["agent-old"] });
    let subscriptions = [
      { id: "s1", agentId: "agent-old" },
      { id: "s2", agentId: "agent-x" },
    ];
    const registry = {
      findMatchingAgent: () => subscriptions.find((s) => s.agentId === "agent-old")?.agentId || null,
      getCoordinator: () => "agent-c",
      removeSubscriptions: (shouldRemove) => {
        const before = subscriptions.length;
        subscriptions = subscriptions.filter((s) => !shouldRemove(s));
        return before - subscriptions.length;
      },
    };
    const dispatcher = new TestDispatcher({ registry, config: { paseoBin: paseo.bin } });

    const result = await dispatcher.dispatch({ text: "hi" });

    assert.equal(result.type, "coordinator");
    assert.deepEqual(subscriptions, [{ id: "s2", agentId: "agent-x" }]);
    assert.equal(paseo.readCalls()[0], "agent-c");
  });

  it("unbinds an archived coordinator and sends nothing", async () => {
    const paseo = createFakePaseo({ archived: ["agent-c"] });
    let coordinator = "agent-c";
    const registry = {
      findMatchingAgent: () => null,
      getCoordinator: () => coordinator,
      setCoordinator: (agentId) => {
        coordinator = agentId;
      },
      removeSubscriptions: () => 0,
    };
    const dispatcher = new TestDispatcher({ registry, config: { paseoBin: paseo.bin } });

    const delivery = await dispatcher.sendToPaseo("agent-c", "hi");

    assert.equal(delivery.inactive, true);
    assert.equal(coordinator, null);
    assert.equal(fs.existsSync(path.join(path.dirname(paseo.bin), "calls.json")), false);
  });
});

describe("BaseEventDispatcher.dispatchBatch", () => {
  it("sends one message per target and moves the events of an archived subscriber to the coordinator", async () => {
    const paseo = createFakePaseo({ archived: ["agent-old"] });
    const registry = {
      findMatchingAgent: (event) => (event.text === "watched" ? "agent-old" : null),
      getCoordinator: () => "agent-c",
      removeSubscriptions: () => 1,
    };
    const dispatcher = new TestDispatcher({ registry, config: { paseoBin: paseo.bin } });

    const { results, unrouted } = await dispatcher.dispatchBatch([
      { text: "watched" },
      { text: "other" },
      { text: "noise", noise: true },
    ]);

    assert.equal(results.length, 1);
    assert.equal(results[0].agentId, "agent-c");
    assert.deepEqual(
      results[0].events.map((event) => event.text),
      ["other", "watched"],
    );
    assert.deepEqual(unrouted, []);
    assert.deepEqual(paseo.readCalls(), ["agent-c", "prompt:other", "", "prompt:watched"]);
  });
});

describe("BaseEventDispatcher agent status", () => {
  it("treats an agent Paseo does not know as inactive", async () => {
    const paseo = createFakePaseo({ missing: ["agent-gone"] });
    const dispatcher = new TestDispatcher({ registry: registryWith(), config: { paseoBin: paseo.bin } });
    assert.equal(await dispatcher.isAgentInactive("agent-gone"), true);
  });

  it("keeps the subscriptions when Paseo itself fails, whatever the error text says", async () => {
    const paseo = createFakePaseo({ broken: true });
    const dispatcher = new TestDispatcher({ registry: registryWith(), config: { paseoBin: paseo.bin } });
    assert.equal(await dispatcher.isAgentInactive("agent-c"), false);
  });
});
