import type { SubscriptionRegistry } from "./subscriptions.js";

export class GitLabDaemon {
  constructor(options?: { registry?: SubscriptionRegistry; workHoursOnly?: boolean });
  start(): Promise<void>;
  stop(): void;
}
