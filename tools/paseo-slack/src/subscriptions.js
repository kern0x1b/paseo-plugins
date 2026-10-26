import path from 'node:path';
import { BaseSubscriptionRegistry, defaultRouterDirectory } from 'paseo-fleet-kit';

export class SubscriptionRegistry extends BaseSubscriptionRegistry {
  constructor(filePath = path.join(defaultRouterDirectory('slack-router'), 'subscriptions.json')) {
    super({ filePath, idPrefix: 'sub' });
  }

  add({ agentId, channel, thread_ts, sender }) {
    if (!agentId) {
      throw new Error('agentId is required for subscription');
    }

    const subscription = {
      id: this.newSubscriptionId(),
      agentId,
      channel: channel || null,
      thread_ts: thread_ts || null,
      sender: sender || null,
      createdAt: new Date().toISOString(),
    };

    return this.addSubscription(
      subscription,
      (existing, added) =>
        existing.agentId === agentId &&
        existing.channel === added.channel &&
        existing.thread_ts === added.thread_ts &&
        existing.sender === added.sender,
    );
  }

  remove({ id, agentId, thread_ts }) {
    return this.removeSubscriptions((subscription) => {
      if (id && subscription.id === id) return true;
      if (thread_ts && subscription.thread_ts === thread_ts) return true;
      if (agentId && !thread_ts && !id && subscription.agentId === agentId) return true;
      return false;
    });
  }

  findMatchingAgent(event) {
    for (const subscription of this.list()) {
      if (subscription.thread_ts && event.thread_ts !== subscription.thread_ts) continue;
      if (subscription.channel && event.channel !== subscription.channel) continue;
      if (subscription.sender && event.user !== subscription.sender) continue;
      return subscription.agentId;
    }

    return null;
  }
}
