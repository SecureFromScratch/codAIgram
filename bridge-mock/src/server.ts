import * as http from "node:http";
import { randomBytes } from "node:crypto";
import { isChatPromptRequest, PendingEditorWaits, scheduleEditorWaitTimeout, validateWorkspaceRequest } from "@codaigram/bridge-protocol";
import type { MockConfig } from "./config";
import { WebSocket, WebSocketServer } from "ws";
import type { RawData } from "ws";

const HOST: string = "127.0.0.1";
const DEFAULT_ORIGINS: readonly string[] = ["https://codai.example"];
const sessionIdByClient: Map<WebSocket, string> = new Map<WebSocket, string>();
const sessionStates: Map<string, "active" | "available"> = new Map<string, "active" | "available">();
const sessionClientById: Map<string, WebSocket> = new Map<string, WebSocket>();

export async function startMock(config: MockConfig): Promise<http.Server> {
  const httpServer: http.Server = http.createServer((request, response) => {
    if (request.method !== "GET") {
      response.writeHead(405);
      response.end("Method Not Allowed");
      return;
    }
    response.writeHead(404);
    response.end("Not Found");
  });
  let pairingTokenUsed: boolean = false;
  const wsServer: WebSocketServer = new WebSocketServer({ noServer: true, maxPayload: 65_536 });
  httpServer.on("upgrade", (request, socket, head) => {
    const address: ReturnType<http.Server["address"]> = httpServer.address();
    const expectedPort: number | undefined = address && typeof address !== "string" ? address.port : undefined;
    const expectedHost: boolean = typeof expectedPort === "number" && (request.headers.host === `localhost:${expectedPort}` || request.headers.host === `${HOST}:${expectedPort}`);
    const origin: string | undefined = request.headers.origin;
    const trustedOrigins: readonly string[] = config.trustedOrigins === undefined ? DEFAULT_ORIGINS : config.trustedOrigins;
    const acceptedOrigin: boolean = typeof origin === "string" && trustedOrigins.includes(origin);
    const requestText: string = request.url ?? "/";
    const validUrl: boolean = URL.canParse(requestText, `ws://${HOST}`);
    const requestUrl: URL | undefined = validUrl ? new URL(requestText, `ws://${HOST}`) : undefined;
    const isPairingRoute: boolean = requestUrl?.pathname === `/${config.authtoken}` && !pairingTokenUsed;
    const suppliedSessionId: string = requestUrl?.pathname.startsWith("/session/") ? requestUrl.pathname.slice("/session/".length) : "";
    const previousSessionClient: WebSocket | undefined = sessionClientById.get(suppliedSessionId);
    const previousSessionIsClosed: boolean = previousSessionClient !== undefined && previousSessionClient.readyState !== WebSocket.OPEN;
    const isSessionRoute: boolean = suppliedSessionId.length > 0 && (sessionStates.get(suppliedSessionId) === "available" || previousSessionIsClosed);
    if (!expectedHost || !acceptedOrigin || !requestUrl || (!isPairingRoute && !isSessionRoute)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      socket.destroy();
      return;
    }
    const sessionId: string = isSessionRoute ? suppliedSessionId : randomBytes(32).toString("base64url");
    sessionStates.set(sessionId, "active");
    if (previousSessionIsClosed) sessionClientById.delete(sessionId);
    let upgradeCompleted: boolean = false;
    socket.once("close", () => {
      if (!upgradeCompleted) sessionStates.set(sessionId, "available");
    });
    wsServer.handleUpgrade(request, socket, head, (client) => {
      upgradeCompleted = true;
      if (isPairingRoute) pairingTokenUsed = true;
      sessionIdByClient.set(client, sessionId);
      sessionClientById.set(sessionId, client);
      wsServer.emit("connection", client);
    });
  });
  wsServer.on("connection", (client: WebSocket) => {
    const waits: PendingEditorWaits = new PendingEditorWaits((id: string) => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ version: 1, type: "error", id, code: "request_timeout" }));
    }, scheduleEditorWaitTimeout);
    const sessionId: string | undefined = sessionIdByClient.get(client);
    client.once("close", () => {
      waits.clear();
      if (sessionId) sessionStates.set(sessionId, "available");
      if (sessionId && sessionClientById.get(sessionId) === client) sessionClientById.delete(sessionId);
      sessionIdByClient.delete(client);
    });
    let queue: Promise<void> = Promise.resolve();
    client.on("message", (data: RawData, binary: boolean) => {
      if (binary) return;
      queue = queue.then(async () => {
        const result = await validateWorkspaceRequest(data.toString());
        if (result.isErr() || client.readyState !== WebSocket.OPEN) return;
        const request = result.value;
        if (waits.has(request.id)) {
          waits.clear();
          client.close(1008);
        } else if (request.type === "ping") {
          client.send(JSON.stringify({ version: 1, type: "pong", id: request.id }));
        } else if (request.type === "workspace_folders") {
          client.send(JSON.stringify({ version: 1, type: "workspace_folders", id: request.id, syncTimestamp: config.workspaceLastModified, folders: config.workspaceFolders }));
        } else if (request.type === "code/get" && typeof request.projectName === 'string' && Array.isArray(request.workFolders) && typeof request.filepath === 'string' && typeof request.typeName === 'string') {
          const match = config.codeResponses.find((item) => item.projectName === request.projectName && item.filepath === request.filepath && item.typeName === request.typeName);
          if (!match || JSON.stringify(match.expectedWorkFolders) !== JSON.stringify(request.workFolders)) {
            client.send(JSON.stringify({ version: 1, type: "error", id: request.id, code: "code_not_found" }));
          } else {
            client.send(JSON.stringify({ version: 1, type: "code_response", id: request.id, projectName: request.projectName, code: match.code }));
          }
        } else if (isChatPromptRequest(request) && request.syncTimestamp !== config.workspaceLastModified) {
          client.send(JSON.stringify({ version: 1, type: "error", id: request.id, code: "workspace_sync_required", syncTimestamp: config.workspaceLastModified, required: ["workspace_folders"] }));
        } else if (isChatPromptRequest(request)) {
          const match = config.promptResponses.find((pair) => pair.prompt === request.prompt);
          if (match) {
            const validOptions: boolean = match.expectedCwd === request.cwd &&
              JSON.stringify(match.expectedWorkFolders) === JSON.stringify(request.workFolders);
            if (!validOptions) {
              client.send(JSON.stringify({ version: 1, type: "error", id: request.id, code: "prompt_options_mismatch" }));
            } else {
              sendSyntheticChatResponse(client, request.id, match.response);
            }
          } else {
            client.send(JSON.stringify({ version: 1, type: "error", id: request.id, code: "prompt_not_found", status: 500 }));
          }
        } else if (request.type === "cancel" && typeof request.targetId === "string") {
          if (waits.delete(request.targetId)) {
            client.send(JSON.stringify({ version: 1, type: "cancelled", id: request.id, targetId: request.targetId }));
            client.send(JSON.stringify({ version: 1, type: "error", id: request.targetId, code: "request_cancelled" }));
          } else {
            client.send(JSON.stringify({ version: 1, type: "error", id: request.id, code: "request_not_pending" }));
          }
        } else if (request.type === "wait_for_active_editor_change") {
          if (waits.size >= 32) client.send(JSON.stringify({ version: 1, type: "error", id: request.id, code: "too_many_pending_requests" }));
          else waits.add(request.id);
        } else {
          client.send(JSON.stringify({ version: 1, type: "error", id: request.id, code: "unsupported_request" }));
        }
      }).then(() => undefined, () => undefined);
    });
    client.send(JSON.stringify({ version: 1, type: "welcome" }));
    if (sessionId) client.send(JSON.stringify({ version: 1, type: "session", sessionId }));
  });
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(config.port === undefined ? 0 : config.port, HOST, () => resolve());
  });
  const address: ReturnType<http.Server["address"]> = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Mock listener did not expose an address.");
  process.stdout.write(`CodAIgram Bridge mock listening on ws://${HOST}:${address.port}\n`);
  return httpServer;
}

function sendSyntheticChatResponse(client: WebSocket, requestId: string, response: string): void {
  const threadId: string = `mock-thread-${requestId}`;
  client.send(JSON.stringify({
    version: 1,
    type: "chat_event",
    id: requestId,
    event: "thread/status/changed",
    data: { threadId, status: { type: "active", activeFlags: [] } }
  }));

  const responseCharacters: readonly string[] = Array.from(response);
  for (let index: number = 0; index < responseCharacters.length; index += 4) {
    const delta: string = responseCharacters.slice(index, index + 4).join("");
    client.send(JSON.stringify({ version: 1, type: "chat_delta", id: requestId, delta }));
  }

  client.send(JSON.stringify({ version: 1, type: "chat_response", id: requestId, response }));
}
