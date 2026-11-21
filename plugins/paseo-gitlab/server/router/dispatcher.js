import { BaseEventDispatcher } from "paseo-fleet-kit";
import { SubscriptionRegistry } from "./subscriptions.js";
import { loadConfig } from "./config.js";

const MAX_BODY_CHARS = 4000;

export class GitLabEventDispatcher extends BaseEventDispatcher {
  constructor({ registry = new SubscriptionRegistry(), config = loadConfig(), myUsername = null } = {}) {
    super({ registry, config });
    this.myUsername = myUsername;
  }

  buildPrompt(event) {
    return this.buildEventPrompt(event);
  }

  buildEnvelope(event) {
    return this.buildFleetEnvelope(event);
  }

  buildBatchMessage(events) {
    const header = `[GitLab] ${events.length} new event${events.length === 1 ? "" : "s"}`;
    return [header, ...events.map((event, index) => this.buildEventLine(event, index + 1))].join("\n\n");
  }

  buildEventLine(event, number) {
    let headline = event.title || "";
    if (event.targetType !== "Pipeline") {
      const target = event.mrIid ? `!${event.mrIid}` : event.issueIid ? `#${event.issueIid}` : "";
      const action = event.category?.startsWith("To-Do") ? event.category : event.actionName;
      headline = `${[target, action].filter(Boolean).join(" ")} by @${event.author}: ${headline}`;
    }
    const lines = [`${number}. ${headline}`];
    if (event.url) lines.push(`   ${event.url}`);
    if (event.body) {
      const body =
        event.body.length > MAX_BODY_CHARS ? `${event.body.slice(0, MAX_BODY_CHARS)}…` : event.body;
      lines.push(body.replace(/^/gm, "   "));
    }
    return lines.join("\n");
  }

  setMyUsername(username) {
    this.myUsername = username;
  }

  buildEventPrompt(event) {
    const lines = [`[GitLab Incoming ${event.category || "Event"}]`];

    if (event.actionName) lines.push(`Action: ${event.actionName}`);
    if (event.author) lines.push(`Author: ${event.author}`);
    if (event.targetType)
      lines.push(`Target: ${event.targetType} ${event.targetIid ? "#" + event.targetIid : ""}`);
    if (event.title) lines.push(`Title: ${event.title}`);
    if (event.body) {
      lines.push(`Content:`);
      lines.push(event.body);
    }
    if (event.url) lines.push(`URL: ${event.url}`);
    lines.push("---");
    lines.push(`Event JSON: ${JSON.stringify(event.raw || event)}`);

    return lines.join("\n");
  }

  buildFleetEnvelope(event) {
    const host = this.config.host || "https://gitlab.com";
    const project = event.projectPath || event.project || this.config.defaultProjectId || "default";
    const eventType = (event.actionName || event.category || "event").toLowerCase().replace(/[\s()]+/g, "_");
    const actorName = event.author || "unknown";
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
    const urn = `urn:gitlab:${cleanHost}:${project}:${targetType}:${iid || id}`;

    let replyAction = { type: "none" };
    if (event.mrIid) {
      replyAction = {
        type: "mcp",
        tool: "gitlab_create_mr_note",
        params: {
          project_id: project,
          mr_iid: Number(event.mrIid),
        },
      };
    } else if (event.issueIid) {
      replyAction = {
        type: "mcp",
        tool: "gitlab_create_issue_note",
        params: {
          project_id: project,
          issue_iid: Number(event.issueIid),
        },
      };
    }

    return {
      protocol: "paseo-fleet/v1",
      id: `evt_gl_${id}`,
      timestamp: new Date().toISOString(),
      source: "gitlab",
      instance: host,
      scope: String(project),
      urn,
      event_type: eventType,
      actor: {
        id: actorName,
        name: actorName,
        is_bot: actorName.includes("bot") || actorName === "GitLab CI/CD",
      },
      target: {
        type: targetType,
        id: String(iid || id),
        title: event.title || "",
        url: event.url || "",
      },
      content:
        event.body ||
        (event.category && event.title
          ? `[${event.category}] ${event.title}`
          : event.title || event.category || ""),
      reply_action: replyAction,
    };
  }

  async dispatchToCoordinator(event) {
    const coordinatorId = this.resolveCoordinatorId();
    const envelope = this.buildFleetEnvelope(event);
    const envelopeJson = JSON.stringify(envelope, null, 2);

    if (!coordinatorId) {
      return {
        routed: false,
        reason: "No coordinator configured",
        eventPrompt: envelopeJson,
      };
    }

    const result = await this.sendToPaseo(coordinatorId, envelopeJson);
    return {
      routed: true,
      type: "coordinator",
      targetAgent: coordinatorId,
      delivery: result,
      envelope,
    };
  }
}

export { GitLabEventDispatcher as EventDispatcher };
