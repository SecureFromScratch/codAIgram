import { createBridgeClient, createBridgeClientForSession, type BridgeClient, type WorkspaceFolder } from '@codaigram/bridge-protocol/client';
import { readAppStorageValue, removeAppStorageValue, writeAppStorageValue } from './app-storage';
import type { AppStorageKeyT, AppStorageReadT } from './app-storage';

export type VscodeWorkspaceFolderT = WorkspaceFolder;

export type VscodeBridgeConnectionT = {
  readonly client: BridgeClient;
  readonly workspaces: readonly VscodeWorkspaceFolderT[];
  readonly session: PersistedVscodeBridgeSessionT;
};

export type PersistedVscodeBridgeSessionT = { readonly endpoint: string; readonly sessionId: string };

export function bridgeConnectionFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'The browser could not connect to the VS Code bridge and did not provide a reason. Check that the bridge is running and that the link is current.';
  }
  if (error.message === 'The bridge connection timed out.') {
    return 'The VS Code bridge did not respond within 10 seconds. Check that the CodAIgram Bridge extension is running, then try again.';
  }
  if (error.message === 'The bridge request timed out.') {
    return 'The WebSocket connected, but the VS Code bridge did not return its workspace list. Check the CodAIgram Bridge Output panel in VS Code.';
  }
  if (error.message === 'WebSocket connection failed.' || error.message === 'The bridge connection closed before it was ready.') {
    return 'The browser could not complete the WebSocket handshake and does not expose the cause. The bridge may be unreachable, or it may have rejected the link/session or this site’s origin. Check that the extension is running, use a current bridge link, and see the “CodAIgram Bridge” Output panel in VS Code for rejection details.';
  }
  return error.message;
}

export function loadPersistedVscodeBridgeSession(): PersistedVscodeBridgeSessionT | undefined {
  try {
    const key: AppStorageKeyT = 'vscodeBridgeSession';
    const savedValue: AppStorageReadT = readAppStorageValue(key);
    if (savedValue.state === 'missing') return noPersistedBridgeSession();
    const parsed: unknown = JSON.parse(savedValue.value);
    if (typeof parsed !== 'object' || !parsed || !('endpoint' in parsed) || !('sessionId' in parsed)) {
      clearPersistedVscodeBridgeSession();
      return noPersistedBridgeSession();
    }
    const endpoint: unknown = parsed.endpoint;
    const sessionId: unknown = parsed.sessionId;
    if (typeof endpoint !== 'string' || typeof sessionId !== 'string' || sessionId.length === 0) {
      clearPersistedVscodeBridgeSession();
      return noPersistedBridgeSession();
    }
    const endpointUrl: URL = new URL(endpoint);
    if ((endpointUrl.protocol !== 'ws:' && endpointUrl.protocol !== 'wss:') || endpointUrl.pathname !== '/') {
      clearPersistedVscodeBridgeSession();
      return noPersistedBridgeSession();
    }
    return { endpoint: endpointUrl.origin, sessionId };
  } catch (error: unknown) {
    // UNTRUST-ALLOW-UNLOGGED-THROW: A corrupt browser session record is logged without its contents and removed so normal manual bridge pairing remains available.
    console.warn('Could not restore the saved VS Code bridge session.', error instanceof Error ? error.message : 'invalid session data');
    clearPersistedVscodeBridgeSession();
    return noPersistedBridgeSession();
  }
}

function noPersistedBridgeSession(): undefined {
  // UNTRUST-ALLOW-NULLISH: A missing or invalid saved session deliberately selects manual pairing, and this single return centralizes that optional startup state for all storage validation branches.
  return undefined;
}

export function savePersistedVscodeBridgeSession(session: PersistedVscodeBridgeSessionT): void {
  try {
    const key: AppStorageKeyT = 'vscodeBridgeSession';
    writeAppStorageValue(key, JSON.stringify(session));
  } catch (error: unknown) {
    console.warn('Could not save the VS Code bridge session.', error instanceof Error ? error.message : 'storage unavailable');
  }
}

export function clearPersistedVscodeBridgeSession(): void {
  try {
    const key: AppStorageKeyT = 'vscodeBridgeSession';
    removeAppStorageValue(key);
  } catch (error: unknown) {
    console.warn('Could not clear the saved VS Code bridge session.', error instanceof Error ? error.message : 'storage unavailable');
  }
}

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

export async function connectToVscodeBridge(connectionLink: string, sessionId?: string): Promise<VscodeBridgeConnectionT> {
  let connectionUrl: URL;
  try {
    connectionUrl = new URL(connectionLink);
  } catch (error: unknown) {
    console.warn('Bridge URL parsing failed.', error);
    // UNTRUST-ALLOW-UNLOGGED-THROW: The parsing exception has already been logged above; return a stable user-facing validation error without exposing URL parser details.
    throw new Error('Enter a valid VS Code bridge link.');
  }
  // UNTRUST-ALLOW-NULLISH: A supplied nonempty session ID selects the reconnect route; absence selects the one-time pairing URL validation and client factory.
  const isSessionReconnect: boolean = sessionId !== undefined;
  if (
    (connectionUrl.protocol !== 'http:' && connectionUrl.protocol !== 'https:' && connectionUrl.protocol !== 'ws:' && connectionUrl.protocol !== 'wss:') ||
    (isSessionReconnect ? connectionUrl.pathname !== '/' : connectionUrl.pathname === '/' || connectionUrl.pathname.slice(1).includes('/')) ||
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

  const endpoint: string = `${connectionUrl.protocol}//${connectionUrl.host}`;
  // UNTRUST-ALLOW-NULLISH: The optional session ID chooses whether this is a first pairing or a reconnect; the session factory receives a defined ID only in the latter branch.
  const client: BridgeClient = sessionId === undefined
    ? createBridgeClient(connectionUrl.toString(), window.location.origin)
    : createBridgeClientForSession(endpoint, sessionId, window.location.origin);
  try {
    const workspaces: readonly VscodeWorkspaceFolderT[] = await client.getFolders();
    const connectedSessionId: string = await client.waitForSessionId();
    return {
      client,
      workspaces,
      session: { endpoint, sessionId: connectedSessionId },
    };
  } catch (error: unknown) {
    // UNTRUST-ALLOW-UNLOGGED-THROW: The bridge request failure is logged here, then the client is closed and the same original error is rethrown for the UI error handler.
    console.warn('Could not retrieve VS Code workspaces through the bridge client.', error);
    await client.close();
    // UNTRUST-ALLOW-UNLOGGED-THROW: The original bridge request error was logged above and is rethrown unchanged after closing the client so the UI can report failure.
    throw error;
  }
}
