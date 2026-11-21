import type { PluginServerContext } from "@getpaseo/plugin/server";
import { featureSettings } from "../shared/features";
import { GitLabDaemon } from "./router/daemon.js";
import { SubscriptionRegistry } from "./router/subscriptions.js";

export function startEventRouter(server: PluginServerContext): () => void {
  const registry = new SubscriptionRegistry();
  let daemon: GitLabDaemon | null = null;
  let stopped = false;

  const applyEnabled = (enabled: boolean) => {
    if (stopped) return;
    if (enabled && !daemon) {
      daemon = new GitLabDaemon({ registry, workHoursOnly: false });
      daemon.start().catch((error: Error) => {
        console.error(`[GitLab Daemon] Event router failed to start: ${error.message}`);
      });
    } else if (!enabled && daemon) {
      daemon.stop();
      daemon = null;
      console.log("[GitLab Daemon] Event router turned off in the plugin settings");
    }
  };

  const settings = server.registerSettings(featureSettings);
  void settings.read().then((state) => applyEnabled(state.status !== "ready" || state.values.eventRouter));
  const stopWatchingSettings = settings.subscribe((state) => {
    if (state.status === "ready") applyEnabled(state.values.eventRouter);
  });

  const stopWatchingArchives = server.on("agent.archived", ({ agent }) => {
    const removed = registry.removeSubscriptions((subscription) => subscription.agentId === agent.id);
    if (registry.getCoordinator() === agent.id) registry.setCoordinator(null);
    if (removed > 0)
      console.log(`[GitLab Daemon] Agent ${agent.id} archived: removed ${removed} subscription(s)`);
  });

  return () => {
    stopped = true;
    stopWatchingSettings();
    stopWatchingArchives();
    daemon?.stop();
    daemon = null;
  };
}
