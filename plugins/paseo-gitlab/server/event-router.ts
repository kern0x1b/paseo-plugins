import type { PluginServerContext } from "@getpaseo/plugin/server";
import { GitLabDaemon } from "./router/daemon.js";
import { SubscriptionRegistry } from "./router/subscriptions.js";

export function startEventRouter(server: PluginServerContext): () => void {
  const registry = new SubscriptionRegistry();
  const daemon = new GitLabDaemon({ registry, workHoursOnly: false });

  daemon.start().catch((error: Error) => {
    console.error(`[GitLab Daemon] Event router failed to start: ${error.message}`);
  });

  const stopWatchingArchives = server.on("agent.archived", ({ agent }) => {
    const removed = registry.removeSubscriptions((subscription) => subscription.agentId === agent.id);
    if (registry.getCoordinator() === agent.id) registry.setCoordinator(null);
    if (removed > 0)
      console.log(`[GitLab Daemon] Agent ${agent.id} archived: removed ${removed} subscription(s)`);
  });

  return () => {
    stopWatchingArchives();
    daemon.stop();
  };
}
