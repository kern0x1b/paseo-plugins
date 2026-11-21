export interface Subscription {
  id: string;
  agentId: string;
}

export interface SubscriptionRegistry {
  getCoordinator(): string | null;
  setCoordinator(agentId: string | null): unknown;
  removeSubscriptions(shouldRemove: (subscription: Subscription) => boolean): number;
}

export class SocketListener {
  constructor();
  dispatcher: { registry: SubscriptionRegistry };
  start(): Promise<void>;
  stop(): void;
}
