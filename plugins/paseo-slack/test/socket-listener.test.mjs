import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { SocketListener } from "../server/router/socket-listener.js";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url, opts) {
    this.url = url;
    this.opts = opts;
    this.readyState = FakeWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000 });
  }

  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  triggerMessage(obj) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
  }
}

const OriginalWebSocket = globalThis.WebSocket;

function installFakeWebSocket(t) {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket;
  t.after(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });
  return FakeWebSocket;
}

function makeFakeDispatcher() {
  return {
    calls: [],
    alertCalls: [],
    setMyUserId() {},
    setTeamId(teamId) {
      this.teamId = teamId;
    },
    renderHealthAlert(message) {
      return message;
    },
    async dispatch(event) {
      this.calls.push(event);
      return { routed: false };
    },
    async notifyCoordinator(message) {
      this.alertCalls.push(message);
      return { routed: true, targetAgent: "COORDINATOR" };
    },
  };
}

function makeFakeClient({ openUserSessionSocket, listChannels, getHistory } = {}) {
  return {
    config: { xoxcToken: "fake-xoxc", appToken: "" },
    async authTest() {
      return { user_id: "U_SELF", user: "tester", team: "test", team_id: "T_AUTH" };
    },
    openUserSessionSocket:
      openUserSessionSocket || (async () => ({ url: "wss://fake", headers: {}, selfId: "U_SELF" })),
    listChannels: listChannels || (async () => ({ channels: [{ id: "D1" }] })),
    getHistory: getHistory || (async () => ({ messages: [] })),
  };
}

function testStateFile() {
  return path.join(os.tmpdir(), `slack-router-test-state-${process.pid}-${Date.now()}-${Math.random()}.json`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("enterSocketMode resets attempts/delay on every hello, not just the first", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const client = makeFakeClient();
  const listener = new SocketListener({
    client,
    dispatcher,
    stateFile: testStateFile(),
  });
  t.after(() => listener.stop());
  listener.running = true;

  await listener.connectUserSessionSocket();
  const ws1 = FakeWebSocket.instances[0];
  ws1.triggerOpen();
  ws1.triggerMessage({ type: "hello" });

  assert.equal(listener.mode, "socket");
  assert.equal(listener.wsAttempts, 0);
  assert.equal(listener.wsReconnectDelay, 1000);

  listener.wsReconnectDelay = 10;
  ws1.close();

  assert.ok(listener.wsReconnectTimer, "a reconnect should be scheduled after a post-hello close");
  assert.equal(listener.wsReconnectDelay, 20, "delay should have doubled once, from 10 to 20");

  await wait(30);
  assert.equal(FakeWebSocket.instances.length, 2, "exactly one reconnect socket should have been created");
  const ws2 = FakeWebSocket.instances[1];
  ws2.triggerOpen();
  ws2.triggerMessage({ type: "hello" });

  assert.equal(listener.wsAttempts, 0);
  assert.equal(listener.wsReconnectDelay, 1000, "reconnect delay must reset on the second hello too");
});

test("a retry that lands during a pending backoff does not open a second socket", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  let openCalls = 0;
  const client = makeFakeClient({
    openUserSessionSocket: async () => {
      openCalls += 1;
      if (openCalls === 1) {
        throw new Error("simulated pre-hello failure");
      }
      return { url: "wss://fake", headers: {}, selfId: "U_SELF" };
    },
  });
  const listener = new SocketListener({
    client,
    dispatcher,
    stateFile: testStateFile(),
  });
  t.after(() => listener.stop());
  listener.running = true;

  listener.wsReconnectDelay = 20;
  await listener.connectUserSessionSocket();

  assert.equal(FakeWebSocket.instances.length, 0, "the failed attempt must not have created a socket");
  assert.ok(listener.wsReconnectTimer, "a reconnect must be pending during the backoff gap");

  await listener.connectUserSessionSocket();
  assert.equal(FakeWebSocket.instances.length, 0, "a call landing during backoff must be a no-op");

  await wait(40);
  assert.equal(
    FakeWebSocket.instances.length,
    1,
    "exactly one socket should be created once backoff elapses",
  );

  const ws = FakeWebSocket.instances[0];
  ws.triggerOpen();
  ws.triggerMessage({ type: "hello" });
  assert.equal(listener.mode, "socket");
  assert.equal(listener.wsReconnectTimer, null);
});

test("a stale socket that is no longer this.ws cannot dispatch a message", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const client = makeFakeClient();
  const listener = new SocketListener({
    client,
    dispatcher,
    stateFile: testStateFile(),
  });
  t.after(() => listener.stop());
  listener.running = true;

  await listener.connectUserSessionSocket();
  const ws1 = FakeWebSocket.instances[0];
  ws1.triggerOpen();
  ws1.triggerMessage({ type: "hello" });
  assert.equal(listener.ws, ws1);

  listener.wsReconnectDelay = 10;
  ws1.close();
  await wait(30);
  const ws2 = FakeWebSocket.instances[1];
  ws2.triggerOpen();
  ws2.triggerMessage({ type: "hello" });
  assert.equal(listener.ws, ws2);

  const callsBefore = dispatcher.calls.length;
  ws1.triggerMessage({ type: "message", channel: "D1", user: "U_OTHER", text: "hi", ts: "123.456" });

  assert.equal(dispatcher.calls.length, callsBefore, "the stale socket must not have dispatched anything");

  ws2.triggerMessage({ type: "message", channel: "D1", user: "U_OTHER", text: "hi", ts: "124.456" });
  assert.equal(dispatcher.calls.length, callsBefore + 1);
});

test("health alert fires once while the socket is down and once on recovery", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const client = makeFakeClient();
  const listener = new SocketListener({
    client,
    dispatcher,
    stateFile: testStateFile(),
  });
  t.after(() => listener.stop());
  listener.running = true;

  listener.wsDownSince = Date.now() - 3 * 60 * 1000;
  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 1);
  assert.match(dispatcher.alertCalls[0], /WebSocket has been down/);

  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 1);

  await listener.connectUserSessionSocket();
  const ws = FakeWebSocket.instances[0];
  ws.triggerOpen();
  ws.triggerMessage({ type: "hello" });
  await wait(10);

  assert.equal(dispatcher.alertCalls.length, 2);
  assert.match(dispatcher.alertCalls[1], /recovered/);

  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 2);
});

test("health alert threshold: a websocket down for over 2 minutes with mode still socket also alerts", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const client = makeFakeClient();
  const listener = new SocketListener({
    client,
    dispatcher,
    stateFile: testStateFile(),
  });
  t.after(() => listener.stop());
  listener.running = true;

  listener.mode = "socket";
  listener.wsDownSince = Date.now() - 3 * 60 * 1000;

  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 1);
  assert.match(dispatcher.alertCalls[0], /WebSocket has been down/);
});

test("a health alert that fails to deliver is retried on the next evaluation, and delivers once a coordinator exists", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  let coordinatorConfigured = false;
  dispatcher.notifyCoordinator = async (message) => {
    dispatcher.alertCalls.push(message);
    if (!coordinatorConfigured) {
      return { routed: false, reason: "No coordinator configured" };
    }
    return { routed: true, targetAgent: "COORDINATOR" };
  };

  const client = makeFakeClient();
  const listener = new SocketListener({
    client,
    dispatcher,
    stateFile: testStateFile(),
  });
  t.after(() => listener.stop());
  listener.running = true;

  listener.wsDownSince = Date.now() - 3 * 60 * 1000;
  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 1, "delivery was attempted");
  assert.equal(listener.alertActive, false, "a failed delivery must not be marked as sent");

  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 2, "a failed alert must be retried, not dropped");
  assert.equal(listener.alertActive, false);

  coordinatorConfigured = true;
  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 3);
  assert.equal(listener.alertActive, true, "delivery succeeded, so the alert is now marked as sent");

  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 3);
});

test("a poll keeps messages from every DM newer than the cursor, whatever order the channels come in", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const histories = {
    D1: [{ ts: "200.000000", user: "U1", type: "message" }],
    D2: [{ ts: "150.000000", user: "U2", type: "message" }],
  };
  const client = makeFakeClient({
    listChannels: async () => ({ channels: [{ id: "D1" }, { id: "D2" }] }),
    getHistory: async ({ channel, oldest }) => ({
      messages: histories[channel].filter((m) => parseFloat(m.ts) > parseFloat(oldest)),
    }),
  });
  const listener = new SocketListener({ client, dispatcher, stateFile: testStateFile() });
  t.after(() => listener.stop());
  listener.running = true;
  listener.lastCheckedTs = "100.000000";

  await listener.fetchMissedDirectMessages(listener.lastCheckedTs, "Missed DM");

  assert.deepEqual(
    dispatcher.calls.map((m) => m.ts),
    ["200.000000", "150.000000"],
  );
  assert.equal(listener.lastCheckedTs, "200.000000");
});

test("a reconnect catches up the DMs sent while the socket was down, and the first hello does not", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const historyCalls = [];
  const client = makeFakeClient({
    getHistory: async (params) => {
      historyCalls.push(params);
      return { messages: [{ ts: "300.000000", user: "U1", type: "message" }] };
    },
  });
  const listener = new SocketListener({ client, dispatcher, stateFile: testStateFile() });
  t.after(() => listener.stop());
  listener.running = true;

  await listener.connectUserSessionSocket();
  const ws1 = FakeWebSocket.instances[0];
  ws1.triggerOpen();
  ws1.triggerMessage({ type: "hello" });
  await wait(5);
  assert.equal(historyCalls.length, 0);

  listener.lastCheckedTs = "250.000000";
  listener.wsReconnectDelay = 1;
  ws1.close();
  await wait(20);
  const ws2 = FakeWebSocket.instances[1];
  ws2.triggerOpen();
  ws2.triggerMessage({ type: "hello" });
  await wait(5);

  assert.equal(historyCalls.length, 1);
  assert.equal(historyCalls[0].oldest, "250.000000");
  assert.ok(historyCalls[0].latest, "the catch-up stops at the reconnect so live messages are not repeated");
  assert.deepEqual(
    dispatcher.calls.map((m) => m.ts),
    ["300.000000"],
  );
});

test("the kind of a G conversation is asked from Slack once and cached", async () => {
  const calls = [];
  const client = {
    ...makeFakeClient(),
    async call(method, params) {
      calls.push([method, params.channel]);
      return { channel: { is_mpim: params.channel === "G_MPIM", is_private: true } };
    },
  };
  const listener = new SocketListener({
    client,
    dispatcher: makeFakeDispatcher(),
    stateFile: testStateFile(),
  });

  assert.equal(await listener.channelTypeOf("G_MPIM"), "mpim");
  assert.equal(await listener.channelTypeOf("G_PRIVATE"), "group");
  assert.equal(await listener.channelTypeOf("G_PRIVATE"), "group");
  assert.equal(await listener.channelTypeOf("D1"), undefined);
  assert.deepEqual(calls, [
    ["conversations.info", "G_MPIM"],
    ["conversations.info", "G_PRIVATE"],
  ]);
});

test("a health check that runs while an alert is still being delivered does not send it twice", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  let releaseDelivery;
  dispatcher.notifyCoordinator = async (message) => {
    dispatcher.alertCalls.push(message);
    await new Promise((resolve) => {
      releaseDelivery = resolve;
    });
    return { routed: true, targetAgent: "COORDINATOR" };
  };
  const listener = new SocketListener({ client: makeFakeClient(), dispatcher, stateFile: testStateFile() });
  t.after(() => listener.stop());
  listener.running = true;
  listener.wsDownSince = Date.now() - 3 * 60 * 1000;

  listener.evaluateHealth();
  listener.evaluateHealth();
  releaseDelivery();
  await wait(10);
  listener.evaluateHealth();
  await wait(10);

  assert.equal(dispatcher.alertCalls.length, 1);
});

test("a rejected session token keeps the socket retrying every five minutes and is named in the alert", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const listener = new SocketListener({ client: makeFakeClient(), dispatcher, stateFile: testStateFile() });
  t.after(() => listener.stop());
  listener.running = true;

  listener.registerWsFailureBeforeHello("Slack API error (rtm.connect): invalid_auth");
  assert.equal(listener.wsReconnectTimer._idleTimeout, 5 * 60 * 1000);
  assert.equal(listener.mode, "connecting", "no second mechanism takes over");

  listener.wsDownSince = Date.now() - 3 * 60 * 1000;
  listener.evaluateHealth();
  await wait(10);
  assert.equal(dispatcher.alertCalls.length, 1);
  assert.match(dispatcher.alertCalls[0], /rejected the session token/);
});

test("a DM history read that fails is not skipped: the catch-up fails and counts as an API failure", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const client = makeFakeClient({
    listChannels: async () => ({ channels: [{ id: "D1" }, { id: "D2" }] }),
    getHistory: async ({ channel }) => {
      if (channel === "D1") throw new Error("Slack API error (conversations.history): internal_error");
      return { messages: [{ ts: "200.000000", user: "U_OTHER", text: "hi" }] };
    },
  });
  const listener = new SocketListener({ client, dispatcher, stateFile: testStateFile() });
  t.after(() => listener.stop());
  listener.running = true;

  await listener.catchUpDirectMessages("100.000000", undefined);

  assert.equal(dispatcher.calls.length, 0, "D2 must not be read past a failed D1");
  assert.notEqual(listener.apiFailureStreakSince, null);
});

test("start fails when Slack refuses the token instead of running without a user id", async (t) => {
  installFakeWebSocket(t);
  const client = makeFakeClient();
  client.authTest = async () => {
    throw new Error("Slack API error (auth.test): invalid_auth");
  };
  const listener = new SocketListener({
    client,
    dispatcher: makeFakeDispatcher(),
    stateFile: testStateFile(),
  });
  t.after(() => listener.stop());

  await assert.rejects(listener.start(), /invalid_auth/);
});

test("start hands the team of the authenticated session to the dispatcher", async (t) => {
  installFakeWebSocket(t);
  const dispatcher = makeFakeDispatcher();
  const listener = new SocketListener({
    client: makeFakeClient(),
    dispatcher,
    stateFile: testStateFile(),
  });
  t.after(() => listener.stop());

  await listener.start();

  assert.equal(dispatcher.teamId, "T_AUTH");
});
