import { usePaseo } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { readLocalStore, writeLocalStore } from "../local-store";

export interface WorkspaceAgent {
  id: string;
  title: string;
  status: string;
}

const PREFERRED_KEY = "paseo-gitlab:review-agent";

export function useWorkspaceAgents(workspaceId: string, enabled = true) {
  const paseo = usePaseo();
  return useQuery({
    queryKey: ["gitlab", "review-agents", workspaceId],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<WorkspaceAgent[]> => {
      const result = await paseo.agents.list({ scope: "active", page: { limit: 200 } });
      return result.entries
        .map(({ agent }) => agent)
        .filter((agent) => agent.workspaceId === workspaceId && !agent.archivedAt)
        .sort((a, b) =>
          (b.lastUserMessageAt ?? b.updatedAt).localeCompare(a.lastUserMessageAt ?? a.updatedAt),
        )
        .map((agent) => ({ id: agent.id, title: agent.title ?? "Untitled agent", status: agent.status }));
    },
  });
}

function preferences(): Record<string, string> {
  return readLocalStore<Record<string, string>>(PREFERRED_KEY) ?? {};
}

export function preferredAgent(
  workspaceId: string,
  agents: WorkspaceAgent[] | undefined,
): WorkspaceAgent | null {
  const remembered = preferences()[workspaceId];
  return agents?.find((agent) => agent.id === remembered) ?? agents?.[0] ?? null;
}

export function rememberAgent(workspaceId: string, agentId: string): void {
  writeLocalStore(PREFERRED_KEY, { ...preferences(), [workspaceId]: agentId });
}
