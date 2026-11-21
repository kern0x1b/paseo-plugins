import type { PluginServerContext } from "@getpaseo/plugin/server";
import { parseCron, type CronSchedule } from "../shared/cron";
import { featureSettings, type FeatureValues } from "../shared/features";
import { GitLabDaemon } from "./router/daemon.js";
import { SubscriptionRegistry } from "./router/subscriptions.js";

type Scope = "mine" | "others";

interface Poller {
  daemon: GitLabDaemon;
  schedule: CronSchedule;
  busy: boolean;
}

const MINUTE_MS = 60_000;

export function startEventRouter(server: PluginServerContext): () => void {
  const registry = new SubscriptionRegistry();
  const pollers = new Map<Scope, Poller>();
  let stopped = false;

  const configure = (scope: Scope, enabled: boolean, cron: string) => {
    const existing = pollers.get(scope);
    if (!enabled) {
      if (existing) {
        existing.daemon.stop();
        pollers.delete(scope);
        console.log(`[GitLab Daemon] ${scope === "mine" ? "My events" : "Other people's events"} turned off`);
      }
      return;
    }
    const schedule = parseCron(cron);
    if (existing) {
      existing.schedule = schedule;
      return;
    }
    const poller: Poller = {
      daemon: new GitLabDaemon({ registry, workHoursOnly: false, scope }),
      schedule,
      busy: true,
    };
    pollers.set(scope, poller);
    poller.daemon
      .prepare()
      .then(() => poller.daemon.pollOnce())
      .catch((error: Error) => console.error(`[GitLab Daemon] ${scope} poll failed: ${error.message}`))
      .finally(() => {
        poller.busy = false;
      });
  };

  const apply = (values: FeatureValues) => {
    if (stopped) return;
    configure("mine", values.myEvents.enabled, values.myEvents.cron);
    configure("others", values.allEvents.enabled, values.allEvents.cron);
  };

  const tick = () => {
    const now = new Date();
    for (const [scope, poller] of pollers) {
      if (poller.busy || !poller.daemon.running || !poller.schedule.matches(now)) continue;
      poller.busy = true;
      poller.daemon
        .pollOnce()
        .catch((error: Error) => console.error(`[GitLab Daemon] ${scope} poll failed: ${error.message}`))
        .finally(() => {
          poller.busy = false;
        });
    }
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduleNextTick = () => {
    timer = setTimeout(
      () => {
        tick();
        if (!stopped) scheduleNextTick();
      },
      MINUTE_MS - (Date.now() % MINUTE_MS) + 1000,
    );
  };
  scheduleNextTick();

  const settings = server.registerSettings(featureSettings);
  void settings
    .read()
    .then((state) => apply(featureSettings.schema.parse(state.status === "ready" ? state.values : {})));
  const stopWatchingSettings = settings.subscribe((state) => {
    if (state.status === "ready") apply(state.values);
  });

  const stopWatchingArchives = server.on("agent.archived", ({ agent }) => {
    const removed = registry.removeSubscriptions((subscription) => subscription.agentId === agent.id);
    if (registry.getCoordinator() === agent.id) registry.setCoordinator(null);
    if (removed > 0)
      console.log(`[GitLab Daemon] Agent ${agent.id} archived: removed ${removed} subscription(s)`);
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stopWatchingSettings();
    stopWatchingArchives();
    for (const poller of pollers.values()) poller.daemon.stop();
    pollers.clear();
  };
}
