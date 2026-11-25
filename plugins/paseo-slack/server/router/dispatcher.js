import {
  BaseEventDispatcher,
  createChannelEvent,
  renderChannelEvent,
  requireChannelValue,
} from "paseo-fleet-kit";
import { SubscriptionRegistry } from "./subscriptions.js";
import { loadConfig } from "./config.js";

export class EventDispatcher extends BaseEventDispatcher {
  source = "slack";

  constructor({ registry = new SubscriptionRegistry(), config = loadConfig(), myUserId = null } = {}) {
    super({ registry, config });
    this.myUserId = myUserId;
    this.teamId = null;
  }

  setMyUserId(userId) {
    this.myUserId = userId;
  }

  setTeamId(teamId) {
    this.teamId = teamId;
  }

  isDirectMessage(channel, channelType) {
    if (channelType) return channelType === "im" || channelType === "mpim";
    return Boolean(channel && channel.startsWith("D"));
  }

  isMentioned(text) {
    if (!this.myUserId || !text) return false;
    return text.includes(`<@${this.myUserId}>`);
  }

  shouldProcess(event) {
    if (!event || event.type !== "message") {
      return false;
    }

    if (event.subtype && event.subtype !== "bot_message" && event.subtype !== "file_share") {
      return false;
    }

    if (this.myUserId && event.user === this.myUserId) {
      return false;
    }

    if (this.registry.findMatchingAgent(event)) {
      return true;
    }

    if (this.isDirectMessage(event.channel, event.channel_type)) {
      return true;
    }

    if (this.isMentioned(event.text)) {
      return true;
    }

    return false;
  }

  rawEventRef(event) {
    return event.ts ?? null;
  }

  buildChannelEvent(event) {
    const isDm = this.isDirectMessage(event.channel, event.channel_type);
    const isMention = this.isMentioned(event.text);
    const kind = isDm ? "dm" : isMention ? "mention" : "thread_reply";
    const teamId = requireChannelValue(this.teamId, "team");
    const channelId = requireChannelValue(event.channel, "channel");
    const ts = requireChannelValue(event.ts, "ts");
    const threadTs = event.thread_ts || ts;

    return createChannelEvent({
      content: event.text || "",
      meta: {
        source: "slack",
        kind,
        urn: `urn:slack:${teamId}:${channelId}:${ts}`,
        channel: channelId,
        user: event.user,
        ts,
        thread_ts: threadTs,
        team: teamId,
      },
    });
  }

  buildHealthChannelEvent(message) {
    const teamId = requireChannelValue(this.teamId, "team");
    return createChannelEvent({
      content: message,
      meta: {
        source: "slack",
        kind: "health_alert",
        urn: `urn:slack:${teamId}:health:${Date.now()}`,
        team: teamId,
      },
    });
  }

  renderHealthAlert(message) {
    return renderChannelEvent(this.buildHealthChannelEvent(message));
  }

  async dispatch(event) {
    if (!this.shouldProcess(event)) {
      return { routed: false, reason: "Filtered out as background noise" };
    }
    const { results } = await this.dispatchBatch([event]);
    if (results.length === 0) {
      return { routed: false, reason: "No matching subscription and no active coordinator" };
    }
    const [{ agentId, type, delivery }] = results;
    return { routed: true, type, targetAgent: agentId, delivery };
  }

  async notifyCoordinator(message) {
    const coordinatorId = this.resolveCoordinatorId();
    if (!coordinatorId) {
      return { routed: false, reason: "No coordinator configured" };
    }

    const result = await this.sendToPaseo(coordinatorId, message);
    if (!result.success) {
      return {
        routed: false,
        reason: result.error || "paseo send failed",
        targetAgent: coordinatorId,
        delivery: result,
      };
    }
    return { routed: true, targetAgent: coordinatorId, delivery: result };
  }
}
