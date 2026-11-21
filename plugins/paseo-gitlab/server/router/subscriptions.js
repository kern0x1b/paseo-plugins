import path from "node:path";
import { BaseSubscriptionRegistry, defaultRouterDirectory } from "paseo-fleet-kit";

export class SubscriptionRegistry extends BaseSubscriptionRegistry {
  constructor(filePath = path.join(defaultRouterDirectory("gitlab-router"), "subscriptions.json")) {
    super({ filePath, idPrefix: "sub_gl" });
  }

  add({
    agentId,
    projectId = null,
    mrIid = null,
    issueIid = null,
    eventType = null,
    author = null,
    ref = null,
  }) {
    if (!agentId) {
      throw new Error("agentId is required for subscription");
    }

    const sub = {
      id: this.newSubscriptionId(),
      agentId,
      projectId: projectId !== null && projectId !== undefined ? Number(projectId) : null,
      mrIid: mrIid ? Number(mrIid) : null,
      issueIid: issueIid ? Number(issueIid) : null,
      eventType: eventType || null,
      author: author ? String(author).replace(/^@/, "") : null,
      ref: ref ? String(ref) : null,
      createdAt: new Date().toISOString(),
    };

    return this.addSubscription(
      sub,
      (existing, added) =>
        existing.agentId === agentId &&
        existing.projectId === added.projectId &&
        existing.mrIid === added.mrIid &&
        existing.issueIid === added.issueIid &&
        existing.eventType === added.eventType &&
        existing.author === added.author &&
        existing.ref === added.ref,
    );
  }

  remove({ id, agentId, mrIid, issueIid, ref, author }) {
    const sameOwner = (s) => !agentId || s.agentId === agentId;
    return this.removeSubscriptions((s) => {
      if (id && s.id === id) return true;
      if (agentId && !id && !mrIid && !issueIid && !ref && !author && s.agentId === agentId) return true;
      if (mrIid && s.mrIid === Number(mrIid) && sameOwner(s)) return true;
      if (issueIid && s.issueIid === Number(issueIid) && sameOwner(s)) return true;
      if (ref && s.ref === String(ref) && sameOwner(s)) return true;
      if (author && s.author === String(author).replace(/^@/, "") && sameOwner(s)) return true;
      return false;
    });
  }

  findMatchingAgent(event) {
    const subs = this.list();

    let bestMatch = null;
    let highestScore = -1;

    for (const sub of subs) {
      if (sub.projectId && event.projectId && Number(sub.projectId) !== Number(event.projectId)) {
        continue;
      }

      let score = 0;

      if (sub.mrIid) {
        if (!event.mrIid || Number(sub.mrIid) !== Number(event.mrIid)) continue;
        score += 100;
      }

      if (sub.issueIid) {
        if (!event.issueIid || Number(sub.issueIid) !== Number(event.issueIid)) continue;
        score += 100;
      }

      if (sub.ref) {
        const evRef = event.ref || event.raw?.ref || event.push_data?.ref;
        if (!evRef || String(sub.ref) !== String(evRef)) continue;
        score += 50;
      }

      if (sub.author) {
        const evAuthor = event.author ? String(event.author).replace(/^@/, "") : "";
        if (evAuthor !== sub.author) continue;
        score += 30;
      }

      if (sub.eventType && sub.eventType !== "all") {
        const subType = sub.eventType.toLowerCase();
        const evCat = (event.category || "").toLowerCase();
        const evAct = (event.actionName || "").toLowerCase();
        const matches =
          evCat.includes(subType) ||
          evAct.includes(subType) ||
          (subType === "mr" && event.mrIid) ||
          (subType === "issue" && event.issueIid) ||
          (subType === "pipeline" && (event.targetType === "Pipeline" || evAct.startsWith("pipeline")));

        if (!matches) continue;
        score += 20;
      } else if (sub.eventType === "all") {
        score += 5;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = sub.agentId;
      }
    }

    return bestMatch;
  }
}
