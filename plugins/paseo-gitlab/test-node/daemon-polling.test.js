import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GitLabDaemon } from "../server/router/daemon.js";
import { GitLabEventDispatcher } from "../server/router/dispatcher.js";
import { SubscriptionRegistry } from "../server/router/subscriptions.js";

function tempRegistry() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-router-test-")), "subscriptions.json");
  const registry = new SubscriptionRegistry(file);
  registry.setCoordinator("COORD");
  return registry;
}

function commentOnMyMr(id) {
  return {
    id,
    action_name: "commented on",
    author_username: "reviewer",
    target_type: "Note",
    note: { noteable_type: "MergeRequest", noteable_iid: 7, body: `comment ${id}` },
  };
}

function makeDaemon({ client, sendToPaseo, initRetryMs }) {
  const registry = tempRegistry();
  const dispatcher = new GitLabEventDispatcher({ registry, config: {} });
  const sent = [];
  dispatcher.sendToPaseo = async (agentId, text) => {
    sent.push(text);
    return sendToPaseo ? sendToPaseo() : { success: true };
  };
  const daemon = new GitLabDaemon({ client, dispatcher, registry, config: {}, initRetryMs });
  daemon.currentUser = { username: "me" };
  daemon.relevantMrIids = new Set([7]);
  return { daemon, sent };
}

test("events beyond the first page are fetched and delivered oldest first", async () => {
  const newest = Array.from({ length: 100 }, (_, index) => commentOnMyMr(300 - index));
  const older = [commentOnMyMr(200), commentOnMyMr(199), commentOnMyMr(150)];
  const pages = [];
  const client = {
    async getProjectEvents({ page }) {
      pages.push(page);
      return page === 1 ? newest : older;
    },
  };
  const { daemon, sent } = makeDaemon({ client });
  daemon.seenEventIds.add(150);

  const result = await daemon.checkEvents();
  await daemon.deliverQueuedEvents();

  assert.equal(result.success, true);
  assert.deepEqual(pages, [1, 2]);
  assert.equal(sent.length, 1, "one poll sends one message");
  assert.match(sent[0], /^\[GitLab\] 102 new events/);
  assert.ok(sent[0].indexOf("comment 199") < sent[0].indexOf("comment 300"), "oldest first");
  assert.ok(!sent[0].includes("comment 150"), "an event seen before is not sent again");
});

test("an event whose delivery failed is retried on the next poll, and given up after three attempts", async () => {
  const client = {
    async getProjectEvents() {
      return [commentOnMyMr(10)];
    },
  };
  const { daemon, sent } = makeDaemon({
    client,
    sendToPaseo: () => ({ success: false, error: "paseo send: connection refused" }),
  });

  for (let poll = 0; poll < 4; poll++) {
    await daemon.checkEvents();
    await daemon.deliverQueuedEvents();
  }

  assert.equal(sent.length, 3);
  assert.equal(daemon.seenEventIds.has(10), true);
});

test("a failed initialization is retried instead of stopping the daemon", async () => {
  let attempts = 0;
  const client = {
    host: "https://gitlab.example",
    defaultProjectId: 1,
    async getCurrentUser() {
      attempts++;
      if (attempts === 1) throw new Error("getaddrinfo ENOTFOUND");
      return { username: "me", name: "Me" };
    },
    async getOpenedMergeRequests() {
      return [];
    },
    async getOpenedIssues() {
      return [];
    },
    async getTodos() {
      return [];
    },
    async getProjectEvents() {
      return [];
    },
    async getPipelines() {
      return [];
    },
  };
  const { daemon } = makeDaemon({ client, initRetryMs: 5 });
  daemon.running = true;

  const initialized = await daemon.initWithRetry();

  assert.equal(initialized, true);
  assert.equal(attempts, 2);
});

test("an event of a foreign MR is not sent, even with a project-wide subscription", async () => {
  const client = {
    async getProjectEvents() {
      return [
        {
          id: 20,
          action_name: "commented on",
          author_username: "someone",
          target_type: "Note",
          note: { noteable_type: "MergeRequest", noteable_iid: 999, body: "not ours" },
        },
      ];
    },
  };
  const { daemon, sent } = makeDaemon({ client });
  daemon.registry.add({ agentId: "COORD", projectId: 69, eventType: "all" });

  await daemon.checkEvents();
  await daemon.deliverQueuedEvents();

  assert.equal(sent.length, 0);
});

test("a merge request pipeline that fails is sent, also when it starts and fails between two polls", async () => {
  let pipelines = [
    { id: 1, ref: "refs/merge-requests/7/head", status: "running", web_url: "https://gitlab.example/p/1" },
  ];
  const client = {
    async getPipelines({ scope }) {
      assert.equal(scope, undefined, "merge request pipelines are not limited to branches");
      return pipelines;
    },
  };
  const { daemon, sent } = makeDaemon({ client });

  await daemon.checkPipelines();
  await daemon.deliverQueuedEvents();
  assert.equal(sent.length, 0, "the first look only learns the current statuses");

  pipelines = [
    { id: 2, ref: "refs/merge-requests/7/head", status: "failed", web_url: "https://gitlab.example/p/2" },
    { id: 1, ref: "refs/merge-requests/7/head", status: "failed", web_url: "https://gitlab.example/p/1" },
  ];
  await daemon.checkPipelines();
  await daemon.deliverQueuedEvents();

  assert.equal(sent.length, 1);
  assert.match(sent[0], /Pipeline #2 for !7: failed/);
  assert.match(sent[0], /Pipeline #1 for !7: running -> failed/);
});
