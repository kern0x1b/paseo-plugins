import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createDaemonStateStore } from "../src/index.js";

const stateFile = () =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fleet-kit-state-")), "sub", "state.json");

describe("createDaemonStateStore", () => {
  const store = createDaemonStateStore({ routerName: "kit-test-router", processMarker: "kit-test" });

  it("derives the default state file from the router name", () => {
    assert.ok(store.defaultStateFile.endsWith(path.join(".config", "kit-test-router", "daemon-state.json")));
  });

  it("saves, reads and clears state", () => {
    const file = stateFile();
    assert.equal(store.readState(file), null);
    store.saveState({ pid: 1, running: true }, file);
    assert.deepEqual(store.readState(file), { pid: 1, running: true });
    store.clearState(file);
    assert.equal(store.readState(file), null);
  });

  it("does not treat a dead or unrelated pid as the daemon", () => {
    const file = stateFile();
    store.saveState({ pid: 999999 }, file);
    assert.equal(store.isDaemonRunning(file), null);
    store.saveState({ pid: process.pid }, file);
    assert.equal(store.isDaemonRunning(file), null);
  });
});
