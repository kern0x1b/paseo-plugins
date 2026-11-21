export interface Subscription {
  id: string;
  agentId: string;
}

export class SubscriptionRegistry {
  constructor(filePath?: string);
  getCoordinator(): string | null;
  setCoordinator(agentId: string | null): unknown;
  removeSubscriptions(shouldRemove: (subscription: Subscription) => boolean): number;
}
