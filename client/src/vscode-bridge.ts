import { createBridgeClient, type BridgeClient, type WorkspaceFolder } from '@codaigram/bridge-protocol/client';

export type VscodeWorkspaceFolderT = WorkspaceFolder;

export type VscodeBridgeConnectionT = {
  readonly client: BridgeClient;
  readonly workspaces: readonly VscodeWorkspaceFolderT[];
};

export function workspaceFolderDisplayPath(uri: string, folderName: string): string {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (error: unknown) {
    // UNTRUST-ALLOW-UNLOGGED-THROW: This formatter logs malformed folder URI data and returns the original string so a single bad path cannot prevent the workspace list from rendering.
    console.warn('Could not parse a VS Code workspace folder URI.', error);
    return uri;
  }
  if (parsed.protocol !== 'file:') return uri;
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch (error: unknown) {
    // UNTRUST-ALLOW-UNLOGGED-THROW: This formatter logs a malformed URI escape and displays the undecoded path, preserving workspace access and the diagnostic value for the operator.
    console.warn('Could not decode a VS Code workspace folder URI.', error);
    decodedPath = parsed.pathname;
  }
  if (/^\/[a-zA-Z]:/.test(decodedPath)) decodedPath = decodedPath.slice(1);
  if (parsed.hostname.length > 0) decodedPath = `//${parsed.hostname}${decodedPath}`;
  decodedPath = decodedPath.replace(/\\/g, '/').replace(/\/$/, '');
  const pathFolderName: string = decodedPath.slice(decodedPath.lastIndexOf('/') + 1);
  if (pathFolderName.toLocaleLowerCase() === folderName.toLocaleLowerCase()) {
    decodedPath = decodedPath.slice(0, decodedPath.lastIndexOf('/'));
  }
  return decodedPath;
}

export async function connectToVscodeBridge(connectionLink: string): Promise<VscodeBridgeConnectionT> {
  let connectionUrl: URL;
  try {
    connectionUrl = new URL(connectionLink);
  } catch (error: unknown) {
    console.warn('Bridge URL parsing failed.', error);
    // UNTRUST-ALLOW-UNLOGGED-THROW: The parsing exception has already been logged above; return a stable user-facing validation error without exposing URL parser details.
    throw new Error('Enter a valid VS Code bridge link.');
  }
  if (
    (connectionUrl.protocol !== 'http:' && connectionUrl.protocol !== 'https:' && connectionUrl.protocol !== 'ws:' && connectionUrl.protocol !== 'wss:') ||
    connectionUrl.pathname === '/' ||
    connectionUrl.pathname.slice(1).includes('/') ||
    connectionUrl.search.length > 0 ||
    connectionUrl.hash.length > 0 ||
    connectionUrl.username.length > 0 ||
    connectionUrl.password.length > 0
  ) {
    // UNTRUST-ALLOW-UNLOGGED-THROW: URL validation rejects malformed caller input before connecting, and this fixed message exposes no parser or network details.
    throw new Error('Enter the bridge URL copied from VS Code.');
  }
  if (connectionUrl.protocol === 'http:') connectionUrl.protocol = 'ws:';
  if (connectionUrl.protocol === 'https:') connectionUrl.protocol = 'wss:';

  const client: BridgeClient = createBridgeClient(connectionUrl.toString(), window.location.origin);
  try {
    const workspaces: readonly VscodeWorkspaceFolderT[] = await client.getFolders();
    return { client, workspaces };
  } catch (error: unknown) {
    // UNTRUST-ALLOW-UNLOGGED-THROW: The bridge request failure is logged here, then the client is closed and the same original error is rethrown for the UI error handler.
    console.warn('Could not retrieve VS Code workspaces through the bridge client.', error);
    await client.close();
    // UNTRUST-ALLOW-UNLOGGED-THROW: The original bridge request error was logged above and is rethrown unchanged after closing the client so the UI can report failure.
    throw error;
  }
}
