import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { BaseEventDispatcher } from "../src/index.js";

function createFakePaseo() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-kit-paseo-"));
  const calls = path.join(directory, "calls.json");
  const bin = path.join(directory, "paseo");
  fs.writeFileSync(
    bin,
    `#!/bin/sh\nprintf '%s\\n' "$2" >> "${calls}"\nprintf '%s' "$3" >> "${calls}"\nprintf '\\n' >> "${calls}"\n`,
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
});
