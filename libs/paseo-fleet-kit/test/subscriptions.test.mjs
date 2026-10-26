import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { BaseSubscriptionRegistry } from "../src/index.js";

function createRegistry() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fleet-kit-subs-"));
  return new BaseSubscriptionRegistry({
    filePath: path.join(directory, "nested", "subs.json"),
    idPrefix: "sub_t",
  });
}

const sameChannel = (existing, added) => existing.channel === added.channel;

describe("BaseSubscriptionRegistry", () => {
  it("starts empty and creates missing directories on save", () => {
    const registry = createRegistry();
    assert.deepEqual(registry.load(), { coordinatorAgentId: null, subscriptions: [] });
    registry.setCoordinator("agent-1");
    assert.equal(registry.getCoordinator(), "agent-1");
  });

  it("replaces a subscription for the same target and keeps others", () => {
    const registry = createRegistry();
    registry.addSubscription({ id: registry.newSubscriptionId(), agentId: "a", channel: "C1" }, sameChannel);
    registry.addSubscription({ id: registry.newSubscriptionId(), agentId: "b", channel: "C2" }, sameChannel);
    registry.addSubscription({ id: registry.newSubscriptionId(), agentId: "c", channel: "C1" }, sameChannel);
    assert.deepEqual(
      registry
        .list()
        .map((subscription) => subscription.agentId)
        .sort(),
      ["b", "c"],
    );
    assert.match(registry.list()[0].id, /^sub_t_[0-9a-f]{8}$/);
  });

  it("removes matching subscriptions and reports how many", () => {
    const registry = createRegistry();
    registry.addSubscription({ id: "x", agentId: "a", channel: "C1" }, sameChannel);
    registry.addSubscription({ id: "y", agentId: "b", channel: "C2" }, sameChannel);
    assert.equal(
      registry.removeSubscriptions((subscription) => subscription.agentId === "a"),
      1,
    );
    assert.equal(
      registry.removeSubscriptions(() => false),
      0,
    );
    assert.equal(registry.list().length, 1);
  });

  it("survives a corrupt file", () => {
    const registry = createRegistry();
    registry.save({ coordinatorAgentId: "x", subscriptions: [] });
    fs.writeFileSync(registry.filePath, "{not json");
    assert.deepEqual(registry.load(), { coordinatorAgentId: null, subscriptions: [] });
  });
});
