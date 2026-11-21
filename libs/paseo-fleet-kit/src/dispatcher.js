import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const AGENT_STATUS_TTL_MS = 60 * 1000;

export class BaseEventDispatcher {
  constructor({ registry, config }) {
    this.registry = registry;
    this.config = config;
  }

  shouldProcess() {
    return true;
  }

  buildPrompt() {
    throw new Error("buildPrompt(event) must be implemented by the adapter");
  }

  buildEnvelope() {
    throw new Error("buildEnvelope(event) must be implemented by the adapter");
  }

  resolveCoordinatorId() {
    return this.registry.getCoordinator() || this.config.coordinatorAgentId || null;
  }

  async inspectAgent(agentId) {
    const paseoBin = this.config.paseoBin || "paseo";
    try {
      const { stdout } = await execFileAsync(paseoBin, ["inspect", agentId, "--json"]);
      return JSON.parse(stdout).Archived ? "inactive" : "active";
    } catch (err) {
      try {
        return JSON.parse(err.stdout || "").error?.code === "AGENT_NOT_FOUND" ? "inactive" : "unknown";
      } catch {
        return "unknown";
      }
    }
  }

  async isAgentInactive(agentId) {
    this.agentStatusCache = this.agentStatusCache || new Map();
    const cached = this.agentStatusCache.get(agentId);
    if (cached && Date.now() - cached.at < AGENT_STATUS_TTL_MS) {
      return cached.status === "inactive";
    }
    const status = await this.inspectAgent(agentId);
    if (status !== "unknown") {
      this.agentStatusCache.set(agentId, { status, at: Date.now() });
    }
    return status === "inactive";
  }

  releaseInactiveAgent(agentId) {
    const removed = this.registry.removeSubscriptions
      ? this.registry.removeSubscriptions((subscription) => subscription.agentId === agentId)
      : 0;
    const wasCoordinator = this.registry.getCoordinator() === agentId;
    if (wasCoordinator && this.registry.setCoordinator) {
      this.registry.setCoordinator(null);
    }
    console.warn(
      `[${new Date().toISOString()}] Agent ${agentId} is archived or gone: removed ${removed} subscription(s)` +
        (wasCoordinator ? " and its coordinator binding" : ""),
    );
  }

  async sendToPaseo(agentId, text) {
    const paseoBin = this.config.paseoBin || "paseo";
    if (await this.isAgentInactive(agentId)) {
      this.releaseInactiveAgent(agentId);
      return { success: false, inactive: true, error: `agent ${agentId} is archived or gone` };
    }
    try {
      const { stdout, stderr } = await execFileAsync(paseoBin, ["send", agentId, text, "--no-wait"]);
      return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  buildBatchMessage(events) {
    return events.map((event) => this.buildPrompt(event)).join("\n\n");
  }

  async dispatchBatch(events) {
    const groups = new Map();
    const unrouted = [];
    const addToGroup = (agentId, type, event) => {
      const key = `${type}:${agentId}`;
      if (!groups.has(key)) groups.set(key, { agentId, type, events: [] });
      groups.get(key).events.push(event);
    };

    const coordinatorEvents = [];
    for (const event of events) {
      if (!this.shouldProcess(event)) continue;
      const specificAgent = this.registry.findMatchingAgent(event);
      if (specificAgent) addToGroup(specificAgent, "specific_agent", event);
      else coordinatorEvents.push(event);
    }

    const results = [];
    for (const group of groups.values()) {
      const delivery = await this.sendToPaseo(group.agentId, this.buildBatchMessage(group.events));
      if (delivery.inactive) coordinatorEvents.push(...group.events);
      else results.push({ ...group, delivery });
    }

    if (coordinatorEvents.length > 0) {
      const coordinatorId = this.resolveCoordinatorId();
      const delivery = coordinatorId
        ? await this.sendToPaseo(coordinatorId, this.buildBatchMessage(coordinatorEvents))
        : null;
      if (delivery && !delivery.inactive) {
        results.push({ agentId: coordinatorId, type: "coordinator", events: coordinatorEvents, delivery });
      } else {
        unrouted.push(...coordinatorEvents);
      }
    }

    return { results, unrouted };
  }

  async dispatch(event) {
    if (!this.shouldProcess(event)) {
      return { routed: false, reason: "Filtered out as background noise" };
    }

    const specificAgent = this.registry.findMatchingAgent(event);
    if (specificAgent) {
      const delivery = await this.sendToPaseo(specificAgent, this.buildPrompt(event));
      if (!delivery.inactive) {
        return { routed: true, type: "specific_agent", targetAgent: specificAgent, delivery };
      }
    }

    const coordinatorId = this.resolveCoordinatorId();
    if (coordinatorId) {
      const envelope = this.buildEnvelope(event);
      const delivery = await this.sendToPaseo(coordinatorId, JSON.stringify(envelope, null, 2));
      if (!delivery.inactive) {
        return { routed: true, type: "coordinator", targetAgent: coordinatorId, delivery, envelope };
      }
    }

    return {
      routed: false,
      reason: "No matching subscription and no active coordinator",
      eventPrompt: this.buildPrompt(event),
    };
  }
}
