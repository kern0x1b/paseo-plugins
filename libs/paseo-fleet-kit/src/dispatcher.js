import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

  async sendToPaseo(agentId, text) {
    const paseoBin = this.config.paseoBin || "paseo";
    try {
      const { stdout, stderr } = await execFileAsync(paseoBin, ["send", agentId, text, "--no-wait"]);
      return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async dispatch(event) {
    if (!this.shouldProcess(event)) {
      return { routed: false, reason: "Filtered out as background noise" };
    }

    const specificAgent = this.registry.findMatchingAgent(event);
    if (specificAgent) {
      const delivery = await this.sendToPaseo(specificAgent, this.buildPrompt(event));
      return { routed: true, type: "specific_agent", targetAgent: specificAgent, delivery };
    }

    const coordinatorId = this.resolveCoordinatorId();
    if (coordinatorId) {
      const envelope = this.buildEnvelope(event);
      const delivery = await this.sendToPaseo(coordinatorId, JSON.stringify(envelope, null, 2));
      return { routed: true, type: "coordinator", targetAgent: coordinatorId, delivery, envelope };
    }

    return {
      routed: false,
      reason: "No matching subscription and no coordinator configured",
      eventPrompt: this.buildPrompt(event),
    };
  }
}
