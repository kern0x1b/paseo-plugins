import { BaseEventDispatcher } from 'paseo-fleet-kit';
import { SubscriptionRegistry } from './subscriptions.js';
import { loadConfig } from './config.js';

export class EventDispatcher extends BaseEventDispatcher {
  constructor({ registry = new SubscriptionRegistry(), config = loadConfig(), myUserId = null } = {}) {
    super({ registry, config });
    this.myUserId = myUserId;
  }

  buildPrompt(event) {
    return this.buildMessagePrompt(event);
  }

  buildEnvelope(event) {
    return this.buildFleetEnvelope(event);
  }

  setMyUserId(userId) {
    this.myUserId = userId;
  }

  isDirectMessage(channel) {
    if (!channel) return false;
    return channel.startsWith('D') || channel.startsWith('G');
  }

  isMentioned(text) {
    if (!this.myUserId || !text) return false;
    return text.includes(`<@${this.myUserId}>`);
  }

  shouldProcess(event) {
    if (!event || event.type !== 'message') {
      return false;
    }

    if (event.subtype && event.subtype !== 'bot_message' && event.subtype !== 'file_share') {
      return false;
    }

    if (this.myUserId && event.user === this.myUserId) {
      return false;
    }

    if (this.registry.findMatchingAgent(event)) {
      return true;
    }

    if (this.isDirectMessage(event.channel)) {
      return true;
    }

    if (this.isMentioned(event.text)) {
      return true;
    }

    return false;
  }

  buildMessagePrompt(event) {
    const isDm = this.isDirectMessage(event.channel);
    const isMention = this.isMentioned(event.text);
    const category = isDm ? 'Direct Message (DM)' : isMention ? 'Mention' : 'Thread reply';

    return [
      `[Slack Incoming ${category}]`,
      `From User: ${event.user || 'unknown'}`,
      `Channel: ${event.channel}`,
      event.thread_ts ? `Thread TS: ${event.thread_ts}` : null,
      `Message TS: ${event.ts}`,
      `Text:`,
      event.text,
      `---`,
      `Event JSON: ${JSON.stringify(event)}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  buildFleetEnvelope(event) {
    const isDm = this.isDirectMessage(event.channel);
    const isMention = this.isMentioned(event.text);
    const eventType = isDm ? 'dm' : isMention ? 'mention' : 'thread_reply';
    const teamId = event.team || this.config.teamId || 'default';
    const channelId = event.channel || 'unknown';
    const ts = event.ts || Date.now().toString();
    const threadTs = event.thread_ts || event.ts || null;
    const actorId = event.user || 'unknown';
    const actorName = event.username || event.user || 'Anonymous';
    const isBot = Boolean(event.bot_id || event.subtype === 'bot_message');

    return {
      protocol: 'paseo-fleet/v1',
      id: `evt_slack_${teamId}_${channelId}_${ts.replace('.', '_')}`,
      timestamp: new Date().toISOString(),
      source: 'slack',
      instance: teamId,
      scope: channelId,
      urn: `urn:slack:${teamId}:${channelId}:${ts}`,
      event_type: eventType,
      actor: {
        id: actorId,
        name: actorName,
        is_bot: isBot,
      },
      target: {
        type: threadTs ? 'thread' : 'channel',
        id: threadTs || channelId,
        channel: channelId,
        team: teamId,
      },
      content: event.text || '',
      reply_action: {
        type: 'mcp',
        tool: 'slack_send_message',
        params: {
          channel: channelId,
          ...(threadTs ? { thread_ts: threadTs } : {}),
        },
      },
    };
  }

  async notifyCoordinator(message) {
    const coordinatorId = this.resolveCoordinatorId();
    if (!coordinatorId) {
      return { routed: false, reason: 'No coordinator configured' };
    }

    const result = await this.sendToPaseo(coordinatorId, message);
    if (!result.success) {
      return {
        routed: false,
        reason: result.error || 'paseo send failed',
        targetAgent: coordinatorId,
        delivery: result,
      };
    }
    return { routed: true, targetAgent: coordinatorId, delivery: result };
  }
}
