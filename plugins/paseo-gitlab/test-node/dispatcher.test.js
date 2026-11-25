import { test } from "node:test";
import assert from "node:assert/strict";
import { GitLabEventDispatcher } from "../server/router/dispatcher.js";

const mergeRequestEvent = {
  category: "MergeRequest",
  actionName: "merge_request_opened",
  author: "dev.user",
  mrIid: 42,
  projectPath: "core/backend",
  title: "Add payment gateway",
  body: "Implements Stripe v3 integration",
  url: "https://gitlab.corp.net/core/backend/-/merge_requests/42",
};

test("buildChannelEvent maps a merge request event to source, kind, urn and meta", () => {
  const dispatcher = new GitLabEventDispatcher({
    config: { host: "https://gitlab.corp.net", defaultProjectId: "core/backend" },
    myUsername: "bot.user",
  });

  const { content, meta } = dispatcher.buildChannelEvent(mergeRequestEvent);

  assert.equal(
    content,
    "!42 merge_request_opened by @dev.user: Add payment gateway\nImplements Stripe v3 integration",
  );
  assert.deepEqual(meta, {
    source: "gitlab",
    kind: "merge_request_opened",
    urn: "urn:gitlab:gitlab.corp.net:core/backend:mr:42",
    url: "https://gitlab.corp.net/core/backend/-/merge_requests/42",
    author: "dev.user",
    title: "Add payment gateway",
    project: "core/backend",
    mr: "42",
  });
});

test("buildPrompt renders the channel tag with source, kind and urn first", () => {
  const dispatcher = new GitLabEventDispatcher({
    config: { host: "https://gitlab.corp.net", defaultProjectId: "core/backend" },
  });

  const rendered = dispatcher.buildPrompt(mergeRequestEvent);

  assert.match(
    rendered,
    /^<channel source="gitlab" kind="merge_request_opened" urn="urn:gitlab:gitlab.corp.net:core\/backend:mr:42" author="dev.user" mr="42" project="core\/backend" title="Add payment gateway" url="https:\/\/gitlab\.corp\.net\/core\/backend\/-\/merge_requests\/42">\n/,
  );
  assert.match(rendered, /\n<\/channel>$/);
});

test("a batch is channel tags separated by a blank line, with no header", () => {
  const dispatcher = new GitLabEventDispatcher({
    config: { host: "https://gitlab.corp.net", defaultProjectId: "core/backend" },
  });
  const issueEvent = { actionName: "issue_created", author: "qa.lead", issueIid: 15, title: "Bug in auth" };

  const batch = dispatcher.buildBatchMessage([mergeRequestEvent, issueEvent]);

  const [first, second] = batch.split("\n\n<channel ");
  assert.equal(first, dispatcher.buildPrompt(mergeRequestEvent));
  assert.equal(`<channel ${second}`, dispatcher.buildPrompt(issueEvent));
  assert.doesNotMatch(batch, /new events?/);
});

test("events of the others router carry scope=others and nothing else changes", () => {
  const config = { host: "https://gitlab.corp.net", defaultProjectId: "core/backend" };
  const others = new GitLabEventDispatcher({ config, scope: "others" }).buildChannelEvent(mergeRequestEvent);
  const mine = new GitLabEventDispatcher({ config }).buildChannelEvent(mergeRequestEvent);

  const { scope, ...othersWithoutScope } = others.meta;
  assert.equal(scope, "others");
  assert.equal("scope" in mine.meta, false);
  assert.deepEqual(othersWithoutScope, mine.meta);
});

test("pipeline events carry the pipeline id and the title as content", () => {
  const dispatcher = new GitLabEventDispatcher({
    config: { host: "https://gitlab.corp.net", defaultProjectId: "core/backend" },
  });
  const pipelineEvent = {
    category: "Pipeline Alert (FAILED)",
    actionName: "pipeline_failed",
    author: "GitLab CI/CD",
    targetType: "Pipeline",
    targetIid: 77,
    mrIid: null,
    title: "Pipeline #77 for refs/heads/main: running -> failed",
    url: "https://gitlab.corp.net/core/backend/-/pipelines/77",
    raw: { id: 77 },
  };

  const { content, meta } = dispatcher.buildChannelEvent(pipelineEvent);

  assert.equal(content, "Pipeline #77 for refs/heads/main: running -> failed");
  assert.equal(meta.pipeline, "77");
  assert.equal(meta.kind, "pipeline_failed");
  assert.equal(meta.urn, "urn:gitlab:gitlab.corp.net:core/backend:pipeline:77");
});

test("the project comes from the event when the config has no default project", () => {
  const dispatcher = new GitLabEventDispatcher({ config: { host: "https://gitlab.corp.net" } });
  const { meta } = dispatcher.buildChannelEvent({
    actionName: "commented on",
    author: "dev.user",
    mrIid: 42,
    raw: { id: 9, project_id: 7 },
  });

  assert.equal(meta.project, "7");
  assert.equal(meta.urn, "urn:gitlab:gitlab.corp.net:7:mr:42");
});

test("an event with no project anywhere is refused instead of getting a default project", () => {
  const dispatcher = new GitLabEventDispatcher({ config: { host: "https://gitlab.corp.net" } });
  assert.throws(
    () => dispatcher.buildChannelEvent({ actionName: "commented on", author: "dev.user", mrIid: 42 }),
    /project is required to build a channel event/,
  );
});

test("a title with markup characters is escaped in the attribute", () => {
  const dispatcher = new GitLabEventDispatcher({
    config: { host: "https://gitlab.corp.net", defaultProjectId: "core/backend" },
  });
  const rendered = dispatcher.buildPrompt({
    actionName: "issue_created",
    author: "qa.lead",
    issueIid: 15,
    title: 'Fix "auth" & <login>',
  });
  assert.match(rendered, /title="Fix &quot;auth&quot; &amp; &lt;login&gt;"/);
});

test("dispatch sends the channel tag to the coordinator when nothing subscribes", async () => {
  const calls = [];
  const fakeRegistry = {
    findMatchingAgent: () => null,
    getCoordinator: () => "coordinator-999",
  };

  const dispatcher = new GitLabEventDispatcher({
    registry: fakeRegistry,
    config: { host: "https://gitlab.com", defaultProjectId: "my-org/web" },
    myUsername: "bot.user",
  });

  dispatcher.sendToPaseo = async (agentId, prompt) => {
    calls.push({ agentId, prompt });
    return { success: true, stdout: "ok", stderr: "" };
  };

  const result = await dispatcher.dispatch({
    category: "Issue",
    actionName: "issue_created",
    author: "qa.lead",
    issueIid: 15,
    title: "Bug in auth",
    body: "Token expired too early",
  });

  assert.equal(result.routed, true);
  assert.equal(result.type, "coordinator");
  assert.equal(result.targetAgent, "coordinator-999");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].agentId, "coordinator-999");
  assert.match(
    calls[0].prompt,
    /^<channel source="gitlab" kind="issue_created" urn="urn:gitlab:gitlab.com:my-org\/web:issue:15"/,
  );
  assert.doesNotMatch(calls[0].prompt, /paseo-fleet|reply_action/);
});

test("the project of a to-do comes from the raw event when the event has no project path", () => {
  const dispatcher = new GitLabEventDispatcher({ config: { host: "https://gitlab.corp.net" } });
  const { meta } = dispatcher.buildChannelEvent({
    actionName: "review_requested",
    author: "dev.user",
    mrIid: 42,
    raw: { id: 9, project: { id: 7, path_with_namespace: "core/backend" } },
  });
  assert.equal(meta.project, "core/backend");
  assert.equal(meta.urn, "urn:gitlab:gitlab.corp.net:core/backend:mr:42");
});

test("a GitLab event that cannot be built becomes a delivery_error tag and the batch goes on", (t) => {
  t.mock.method(console, "error", () => {});
  const dispatcher = new GitLabEventDispatcher({ config: { host: "https://gitlab.corp.net" } });
  const valid = {
    actionName: "issue_created",
    author: "qa.lead",
    issueIid: 15,
    projectPath: "core/backend",
    title: "Bug",
  };
  const broken = { actionName: "commented on", author: "dev.user", mrIid: 42, raw: { id: 555 } };

  const batch = dispatcher.buildBatchMessage([valid, broken]);

  assert.match(batch, /^<channel source="gitlab" kind="issue_created" /);
  assert.match(
    batch,
    /<channel source="gitlab" kind="delivery_error" urn="urn:gitlab:error:555">\nproject is required to build a channel event\nraw event: 555\n<\/channel>$/,
  );
});
