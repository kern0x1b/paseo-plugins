import { test } from "node:test";
import assert from "node:assert/strict";
import { EventDispatcher } from "../server/router/dispatcher.js";

test("EventDispatcher buildChannelEvent maps a channel mention to source, kind, urn and meta", () => {
  const dispatcher = new EventDispatcher({
    config: { teamId: "T01TESTTEAM" },
    myUserId: "U_BOT",
  });

  const event = {
    type: "message",
    user: "U_DEV",
    channel: "C01ALERTS",
    ts: "1728000000.123",
    text: "<@U_BOT> please review this branch",
  };

  const channelEvent = dispatcher.buildChannelEvent(event);

  assert.equal(channelEvent.content, "<@U_BOT> please review this branch");
  assert.deepEqual(channelEvent.meta, {
    source: "slack",
    kind: "mention",
    urn: "urn:slack:T01TESTTEAM:C01ALERTS:1728000000.123",
    channel: "C01ALERTS",
    user: "U_DEV",
    ts: "1728000000.123",
    thread_ts: "1728000000.123",
    team: "T01TESTTEAM",
  });
});

test("EventDispatcher renders the channel tag with source, kind and urn first", () => {
  const dispatcher = new EventDispatcher({ config: { teamId: "T01TESTTEAM" }, myUserId: "U_BOT" });
  const rendered = dispatcher.buildPrompt({
    type: "message",
    user: "U_DEV",
    channel: "C01ALERTS",
    ts: "1728000000.123",
    text: "hi <@U_BOT>",
  });
  assert.match(
    rendered,
    /^<channel source="slack" kind="mention" urn="urn:slack:T01TESTTEAM:C01ALERTS:1728000000.123" channel="C01ALERTS" team="T01TESTTEAM" thread_ts="1728000000.123" ts="1728000000.123" user="U_DEV">\nhi <@U_BOT>\n<\/channel>$/,
  );
});

test("EventDispatcher refuses a message without a team instead of using a default", () => {
  const dispatcher = new EventDispatcher({ config: {}, myUserId: "U_BOT" });
  assert.throws(
    () =>
      dispatcher.buildChannelEvent({ type: "message", user: "U_DEV", channel: "C1", ts: "1.2", text: "x" }),
    /team is required to build a channel event/,
  );
});

test("EventDispatcher sends a compact message to the coordinator", async () => {
  const calls = [];
  const fakeRegistry = {
    findMatchingAgent: () => null,
    getCoordinator: () => "coordinator-agent-123",
  };

  const dispatcher = new EventDispatcher({
    registry: fakeRegistry,
    config: { teamId: "T_WORK" },
    myUserId: "U_BOT",
  });

  dispatcher.sendToPaseo = async (agentId, prompt) => {
    calls.push({ agentId, prompt });
    return { success: true, stdout: "ok", stderr: "" };
  };

  const event = {
    type: "message",
    user: "U_USER",
    channel: "D123DM",
    ts: "1728000001.456",
    text: "Hello coordinator",
  };

  const result = await dispatcher.dispatch(event);

  assert.equal(result.routed, true);
  assert.equal(result.type, "coordinator");
  assert.equal(result.targetAgent, "coordinator-agent-123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].agentId, "coordinator-agent-123");

  assert.match(
    calls[0].prompt,
    /^<channel source="slack" kind="dm" urn="urn:slack:T_WORK:D123DM:1728000001.456" channel="D123DM" team="T_WORK" thread_ts="1728000001.456" ts="1728000001.456" user="U_USER">\nHello coordinator\n<\/channel>$/,
  );
});

test("a private channel is not a direct message, a group DM is", () => {
  const dispatcher = new EventDispatcher({
    registry: { findMatchingAgent: () => null, getCoordinator: () => null },
    config: {},
    myUserId: "U_ME",
  });
  const message = (channel, channelType) => ({
    type: "message",
    user: "U_OTHER",
    channel,
    channel_type: channelType,
    text: "hello",
  });

  assert.equal(dispatcher.shouldProcess(message("G123", "group")), false);
  assert.equal(dispatcher.shouldProcess(message("G123", undefined)), false);
  assert.equal(dispatcher.shouldProcess(message("G456", "mpim")), true);
  assert.equal(dispatcher.shouldProcess(message("D789", undefined)), true);
});
