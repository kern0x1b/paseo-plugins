import { settingsRpc, type PluginCleanup } from "@getpaseo/plugin";
import type { PluginClientContext } from "@getpaseo/plugin/client";
import { startHeaderButtons } from "./client/header-buttons";
import {
  BOARD_PANEL_ID,
  DIFF_PANEL_ID,
  ITEM_PANEL_ID,
  PANEL_ID,
  REPO_PANEL_ID,
  SETTINGS_ID,
  setExplorerToggle,
  setPluginClient,
} from "./client/plugin-client";
import { BoardPanel } from "./client/ui/board-panel";
import { DiffPanel } from "./client/ui/diff-panel";
import { ItemPanel } from "./client/ui/item-panel";
import { GitLabPanel } from "./client/ui/panel";
import { RepositoryPanel } from "./client/ui/repo-panel";
import { GitLabSettings } from "./client/ui/settings";
import { attachmentSearchRpc } from "./shared/contract";
import { featureSettings } from "./shared/features";

const ICON = "GitMerge";

function registerExplorer(client: PluginClientContext): PluginCleanup[] {
  return [
    client.addWorkspacePanel({
      id: PANEL_ID,
      title: "GitLab",
      icon: ICON,
      context: "workspace",
      locations: ["explorer", "workspace"],
      Component: GitLabPanel,
    }),
    client.addWorkspacePanel({
      id: DIFF_PANEL_ID,
      title: "MR diff",
      icon: "FileDiff",
      context: "workspace",
      locations: ["workspace"],
      Component: DiffPanel,
    }),
    client.addWorkspacePanel({
      id: REPO_PANEL_ID,
      title: "Repository",
      icon: "FolderGit2",
      context: "workspace",
      locations: ["workspace"],
      Component: RepositoryPanel,
    }),
    client.addWorkspacePanel({
      id: BOARD_PANEL_ID,
      title: "Issue board",
      icon: "Kanban",
      context: "workspace",
      locations: ["workspace"],
      Component: BoardPanel,
    }),
    client.addWorkspacePanel({
      id: ITEM_PANEL_ID,
      title: "GitLab item",
      icon: "SquareArrowOutUpRight",
      context: "workspace",
      locations: ["workspace"],
      Component: ItemPanel,
    }),
    client.addCommandCenterItem({
      id: "open-gitlab",
      title: "Open GitLab",
      icon: ICON,
      keywords: ["gitlab", "merge request", "mr", "issue", "review"],
      context: "workspace",
      onSelect: (context) => context.openPanel(PANEL_ID, { location: "explorer" }),
    }),
    client.addCommandCenterItem({
      id: "open-gitlab-repository",
      title: "GitLab repository",
      icon: "FolderGit2",
      keywords: ["gitlab", "repository", "files", "branches", "commits"],
      context: "workspace",
      onSelect: (context) => context.openPanel(REPO_PANEL_ID, { location: "workspace" }),
    }),
    client.addCommandCenterItem({
      id: "open-gitlab-board",
      title: "GitLab issue board",
      icon: "Kanban",
      keywords: ["gitlab", "board", "issues", "kanban", "todo"],
      context: "workspace",
      onSelect: (context) => context.openPanel(BOARD_PANEL_ID, { location: "workspace" }),
    }),
    startHeaderButtons(client, ICON),
    client.addAttachmentSource({
      id: "gitlab",
      title: "GitLab",
      icon: ICON,
      pickerTitle: "Attach from GitLab",
      searchPlaceholder: "!123, #45, a GitLab URL, or words",
      search: attachmentSearchRpc,
    }),
  ];
}

export default function contribute(client: PluginClientContext) {
  setPluginClient(client);
  let explorerRemovers: PluginCleanup[] | null = null;
  const setExplorerEnabled = (enabled: boolean) => {
    if (enabled && !explorerRemovers) {
      explorerRemovers = registerExplorer(client);
    } else if (!enabled && explorerRemovers) {
      for (const remove of explorerRemovers) remove();
      explorerRemovers = null;
    }
  };
  setExplorerToggle(setExplorerEnabled);
  const removeSettingsScreen = client.addSettingsScreen({
    id: SETTINGS_ID,
    title: "GitLab",
    icon: ICON,
    Component: GitLabSettings,
  });
  client
    .rpc(settingsRpc(featureSettings.id).read, {})
    .then((state) =>
      setExplorerEnabled(
        state.status !== "ready" || (state.values as { explorer?: boolean }).explorer !== false,
      ),
    )
    .catch(() => setExplorerEnabled(true));

  return () => {
    setExplorerEnabled(false);
    setExplorerToggle(null);
    removeSettingsScreen();
    setPluginClient(null);
  };
}
