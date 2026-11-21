import type { PluginServerContext } from "@getpaseo/plugin/server";
import { startEventRouter } from "./server/event-router";

export default function contribute(server: PluginServerContext) {
  return startEventRouter(server);
}
