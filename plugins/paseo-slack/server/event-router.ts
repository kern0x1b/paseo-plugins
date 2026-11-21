import type { PluginServerContext } from "@getpaseo/plugin/server";
import { SocketListener } from "./router/socket-listener.js";

export function startEventRouter(server: PluginServerContext): () => void {
  const listener = new SocketListener();
  const registry = listener.dispatcher.registry;

  listener.start().catch((error: Error) => {
    console.error(`[slack-router] Event router failed to start: ${error.message}`);
  });

  const stopWatchingArchives = server.on("agent.archived", ({ agent }) => {
    const removed = registry.removeSubscriptions((subscription) => subscription.agentId === agent.id);
    if (registry.getCoordinator() === agent.id) registry.setCoordinator(null);
    if (removed > 0)
      console.log(`[slack-router] Agent ${agent.id} archived: removed ${removed} subscription(s)`);
  });

  return () => {
    stopWatchingArchives();
    listener.stop();
  };
}
