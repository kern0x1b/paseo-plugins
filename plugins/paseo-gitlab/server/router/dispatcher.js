import { BaseEventDispatcher, createChannelEvent, requireChannelValue } from "paseo-fleet-kit";
import { SubscriptionRegistry } from "./subscriptions.js";
import { loadConfig } from "./config.js";

const MAX_BODY_CHARS = 4000;

export class GitLabEventDispatcher extends BaseEventDispatcher {
  constructor({
    registry = new SubscriptionRegistry(),
    config = loadConfig(),
    myUsername = null,
    scope = "mine",
  } = {}) {
    super({ registry, config });
    this.myUsername = myUsername;
    this.scope = scope;
  }

  buildContent(event) {
    let headline = event.title || "";
    if (event.targetType !== "Pipeline") {
      const target = event.mrIid ? `!${event.mrIid}` : event.issueIid ? `#${event.issueIid}` : "";
      const action = event.category?.startsWith("To-Do") ? event.category : event.actionName;
      headline = `${[target, action].filter(Boolean).join(" ")} by @${event.author}: ${headline}`;
    }
    if (!event.body || event.body.trim() === (event.title || "").trim()) return headline;
    const body = event.body.length > MAX_BODY_CHARS ? `${event.body.slice(0, MAX_BODY_CHARS)}…` : event.body;
    return `${headline}\n${body}`;
  }

  buildChannelEvent(event) {
    const host = requireChannelValue(this.config.host, "host");
    const project = requireChannelValue(
      event.projectPath || event.project || this.config.defaultProjectId || event.raw?.project_id,
      "project",
    );
    const kind = (event.actionName || event.category || "event").toLowerCase().replace(/[\s()]+/g, "_");
    const id = event.raw?.id
      ? String(event.raw.id)
      : `evt_gl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const iid = event.mrIid || event.issueIid || event.targetIid || "";
    const targetType = event.mrIid
      ? "mr"
      : event.issueIid
        ? "issue"
        : (event.targetType || "project").toLowerCase();
    const cleanHost = host.replace(/^https?:\/\//, "");

    return createChannelEvent({
      content: this.buildContent(event),
      meta: {
        source: "gitlab",
        kind,
        urn: `urn:gitlab:${cleanHost}:${project}:${targetType}:${iid || id}`,
        url: event.url,
        author: event.author,
        title: event.title,
        project: String(project),
        mr: event.mrIid,
        issue: event.issueIid,
        pipeline: event.targetType === "Pipeline" ? event.targetIid : undefined,
        scope: this.scope === "others" ? "others" : undefined,
      },
    });
  }

  setMyUsername(username) {
    this.myUsername = username;
  }

  async dispatchToCoordinator(event) {
    const coordinatorId = this.resolveCoordinatorId();
    const message = this.buildPrompt(event);
    if (!coordinatorId) {
      return { routed: false, reason: "No coordinator configured", eventPrompt: message };
    }
    const result = await this.sendToPaseo(coordinatorId, message);
    return { routed: true, type: "coordinator", targetAgent: coordinatorId, delivery: result };
  }
}

export { GitLabEventDispatcher as EventDispatcher };
