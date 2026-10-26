import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { readJsonFile, writeJsonFile } from "./json-file.js";

export function defaultRouterDirectory(routerName) {
  return path.join(os.homedir(), ".config", routerName);
}

export class BaseSubscriptionRegistry {
  constructor({ filePath, idPrefix = "sub" }) {
    this.filePath = filePath;
    this.idPrefix = idPrefix;
  }

  load() {
    return readJsonFile(this.filePath, { coordinatorAgentId: null, subscriptions: [] });
  }

  save(data) {
    writeJsonFile(this.filePath, data);
  }

  getCoordinator() {
    return this.load().coordinatorAgentId;
  }

  setCoordinator(agentId) {
    const data = this.load();
    data.coordinatorAgentId = agentId;
    this.save(data);
    return data;
  }

  list() {
    return this.load().subscriptions || [];
  }

  newSubscriptionId() {
    return `${this.idPrefix}_${crypto.randomBytes(4).toString("hex")}`;
  }

  addSubscription(subscription, isSameTarget) {
    const data = this.load();
    data.subscriptions = (data.subscriptions || []).filter(
      (existing) => !isSameTarget(existing, subscription),
    );
    data.subscriptions.push(subscription);
    this.save(data);
    return subscription;
  }

  removeSubscriptions(shouldRemove) {
    const data = this.load();
    const countBefore = (data.subscriptions || []).length;
    data.subscriptions = (data.subscriptions || []).filter((subscription) => !shouldRemove(subscription));
    this.save(data);
    return countBefore - data.subscriptions.length;
  }
}
