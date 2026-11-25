import {
  CHANNEL_FORMAT,
  createChannelEvent,
  mergeChannelEventsByUrn,
  requireChannelValue,
} from "paseo-fleet-kit";

const MR_ROLE_KINDS = {
  reviewer: "mr_review_requested",
  assignee: "mr_assigned",
  author: "mr_authored",
};

function projectPathFromReference(reference) {
  return reference ? reference.replace(/[!#]\d+$/, "") : null;
}

export class GitLabSnapshot {
  constructor({ client }) {
    this.client = client;
    this.cleanHost = client.host.replace(/^https?:\/\//, "");
    this.errors = [];
  }

  async collect() {
    const generatedAt = new Date().toISOString();
    const user = await this.client.getCurrentUser();
    const username = user.username;

    const [todos, authoredMrs, reviewerMrs, assignedMrs, assignedIssues] = await Promise.all([
      this.fetchList("todos", () => this.client.getTodos({ state: "pending", perPage: 50 })),
      this.fetchList("authored_mrs", () => this.client.getOpenedMergeRequests({ authorUsername: username })),
      this.fetchList("reviewer_mrs", () =>
        this.client.getOpenedMergeRequests({ reviewerUsername: username }),
      ),
      this.fetchList("assigned_mrs", () =>
        this.client.getOpenedMergeRequests({ assigneeUsername: username }),
      ),
      this.fetchList("assigned_issues", () => this.client.getOpenedIssues({ assigneeUsername: username })),
    ]);

    const mrRoles = new Map();
    for (const [role, list] of [
      ["reviewer", reviewerMrs],
      ["assignee", assignedMrs],
      ["author", authoredMrs],
    ]) {
      for (const mr of list) {
        const key = `${mr.project_id}:${mr.iid}`;
        if (!mrRoles.has(key)) mrRoles.set(key, { mr, roles: [] });
        mrRoles.get(key).roles.push(role);
      }
    }

    const mrItems = await Promise.all(
      Array.from(mrRoles.values()).map(({ mr, roles }) =>
        this.buildSafely(`mr:${mr.project_id}!${mr.iid}`, () => this.buildMergeRequestItem(mr, roles)),
      ),
    );
    const issueItems = await Promise.all(
      assignedIssues.map((issue) =>
        this.buildSafely(`issue:${issue.project_id}#${issue.iid}`, () => this.buildIssueItem(issue)),
      ),
    );
    const todoItems = await Promise.all(
      todos.map((todo) => this.buildSafely(`todo:${todo.id}`, () => this.buildTodoItem(todo))),
    );
    const dated = [...mrItems, ...issueItems, ...todoItems].filter(Boolean);

    return {
      format: CHANNEL_FORMAT,
      source: "gitlab",
      generated_at: generatedAt,
      items: mergeChannelEventsByUrn(
        dated.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((item) => item.event),
      ),
      errors: this.errors,
    };
  }

  async fetchList(source, fetcher) {
    try {
      const list = await fetcher();
      if (!Array.isArray(list)) throw new Error(`${source} did not return a list`);
      return list;
    } catch (err) {
      this.errors.push({ source, error: err.message });
      return [];
    }
  }

  async buildSafely(source, build) {
    try {
      return await build();
    } catch (err) {
      this.errors.push({ source, error: err.message });
      return null;
    }
  }

  async fetchOptional(source, fetcher) {
    try {
      return await fetcher();
    } catch (err) {
      this.errors.push({ source, error: err.message });
      return null;
    }
  }

  buildUrn(projectPath, targetType, targetId) {
    return `urn:gitlab:${this.cleanHost}:${projectPath}:${targetType}:${targetId}`;
  }

  buildItem({ projectPath, targetType, targetId, kind, author, title, url, timestamp, content, meta = {} }) {
    return {
      timestamp: timestamp || new Date().toISOString(),
      event: createChannelEvent({
        content,
        meta: {
          source: "gitlab",
          kind,
          urn: this.buildUrn(projectPath, targetType, targetId),
          url,
          author: author?.username,
          title,
          project: projectPath,
          ...meta,
        },
      }),
    };
  }

  async buildMergeRequestItem(mr, roles) {
    const source = `mr:${mr.project_id}!${mr.iid}`;
    const [details, approvals] = await Promise.all([
      this.fetchOptional(source, () =>
        this.client.getMergeRequest({ projectId: mr.project_id, mrIid: mr.iid }),
      ),
      this.fetchOptional(`${source}:approvals`, () =>
        this.client.call(`projects/${mr.project_id}/merge_requests/${mr.iid}/approvals`),
      ),
    ]);

    const merged = { ...mr, ...(details || {}) };
    const pipeline = merged.head_pipeline || merged.pipeline || null;
    const approvedBy = (approvals?.approved_by || []).map((entry) => entry.user?.username).filter(Boolean);
    const projectPath = projectPathFromReference(merged.references?.full) || String(mr.project_id);
    const draft = Boolean(merged.draft || merged.work_in_progress);
    const detailedMergeStatus = merged.detailed_merge_status || merged.merge_status || null;

    const facts = [
      `roles: ${roles.join(", ")}`,
      draft ? "draft" : null,
      details ? (pipeline ? `pipeline ${pipeline.status}` : "no pipeline") : "details not loaded",
      details && detailedMergeStatus ? `merge status ${detailedMergeStatus}` : null,
      merged.has_conflicts ? "has conflicts" : null,
      approvals ? `approved by: ${approvedBy.join(", ") || "nobody"}` : "approvals not loaded",
    ].filter(Boolean);

    return this.buildItem({
      projectPath,
      targetType: "mr",
      targetId: mr.iid,
      kind: MR_ROLE_KINDS[roles[0]],
      author: merged.author,
      title: merged.title,
      url: merged.web_url,
      timestamp: merged.updated_at,
      content: `MR !${mr.iid} "${merged.title}" (${facts.join("; ")})`,
      meta: { mr: mr.iid, pipeline: pipeline?.id },
    });
  }

  buildIssueItem(issue) {
    const projectPath = projectPathFromReference(issue.references?.full) || String(issue.project_id);
    const labels = issue.labels || [];
    return this.buildItem({
      projectPath,
      targetType: "issue",
      targetId: issue.iid,
      kind: "issue_assigned",
      author: issue.author,
      title: issue.title,
      url: issue.web_url,
      timestamp: issue.updated_at,
      content: `Issue #${issue.iid} "${issue.title}"${labels.length ? ` (labels: ${labels.join(", ")})` : ""}`,
      meta: { issue: issue.iid },
    });
  }

  buildTodoItem(todo) {
    const projectPath =
      todo.project?.path_with_namespace || String(requireChannelValue(todo.project?.id, "todo project"));
    const isMergeRequest = todo.target_type === "MergeRequest";
    const isIssue = todo.target_type === "Issue";
    const targetType = isMergeRequest
      ? "mr"
      : isIssue
        ? "issue"
        : String(todo.target_type || "todo").toLowerCase();
    const targetId = todo.target?.iid ?? todo.target?.id ?? todo.id;

    return this.buildItem({
      projectPath,
      targetType,
      targetId,
      kind: `todo_${todo.action_name}`,
      author: todo.author,
      title: todo.target?.title || "",
      url: todo.target_url,
      timestamp: todo.updated_at || todo.created_at,
      content: `To-do (${todo.action_name}) by @${todo.author?.username || "unknown"}: ${todo.body || todo.target?.title || ""}`,
      meta: {
        todo: todo.id,
        mr: isMergeRequest ? targetId : undefined,
        issue: isIssue ? targetId : undefined,
      },
    });
  }
}
