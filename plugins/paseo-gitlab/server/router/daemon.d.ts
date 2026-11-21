import type { SubscriptionRegistry } from "./subscriptions.js";

export class GitLabDaemon {
  constructor(options?: {
    registry?: SubscriptionRegistry;
    workHoursOnly?: boolean;
    scope?: "mine" | "others";
  });
  running: boolean;
  prepare(): Promise<boolean>;
  pollOnce(): Promise<void>;
  start(): Promise<void>;
  stop(): void;
}
