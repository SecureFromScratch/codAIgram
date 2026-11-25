import type { PromptOptions, WorkspaceFolder } from '@codaigram/bridge-protocol/client';
import { logAndThrow } from './client_utils';

export function buildChatPromptOptions(
  workspaces: readonly WorkspaceFolder[],
  selectedWorkspaceUris: readonly string[],
  selectedAgentUris: readonly string[],
): Required<PromptOptions> {
  const selectedWorkspaces: readonly WorkspaceFolder[] = workspaces.filter((workspace: WorkspaceFolder) =>
    selectedWorkspaceUris.includes(workspace.uri) || selectedAgentUris.includes(workspace.uri),
  );
  const activeWorkspaces: readonly WorkspaceFolder[] = selectedWorkspaces.length > 0 ? selectedWorkspaces : workspaces;
  const selectedAiSupportingWorkspaces: readonly WorkspaceFolder[] = activeWorkspaces.filter((workspace: WorkspaceFolder) =>
    selectedAgentUris.includes(workspace.uri) && workspace.configuredAgents.includes('codex'),
  );
  const cwdWorkspace: WorkspaceFolder | undefined = selectedAiSupportingWorkspaces.at(0) ?? activeWorkspaces.at(0);
  if (!cwdWorkspace) return logAndThrow(new Error('No VS Code workspace folder is available for chat.'));

  const cwd: string = workspaceUriToPath(cwdWorkspace.uri);
  const workFolders: readonly string[] = activeWorkspaces
    .map((workspace: WorkspaceFolder) => workspaceUriToPath(workspace.uri))
    .filter((folderPath: string) => folderPath !== cwd);
  return { cwd, workFolders };
}

function workspaceUriToPath(uri: string): string {
  const parsed: URL = new URL(uri);
  if (parsed.protocol !== 'file:') {
    return logAndThrow(new Error('VS Code workspace folders must use file URIs.'));
  }
  let path: string = decodeURIComponent(parsed.pathname);
  if (/^\/[a-zA-Z]:/.test(path)) path = path.slice(1);
  if (parsed.hostname.length > 0) path = `//${parsed.hostname}${path}`;
  return path.replace(/\\/g, '/').replace(/\/$/, '') || '/';
}
