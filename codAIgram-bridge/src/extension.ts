import type { AddressInfo } from "node:net";
import { existsSync } from "node:fs";
import * as net from "node:net";
import * as http from "node:http";
import * as path from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import * as vscode from "vscode";
import { WebSocket, WebSocketServer } from "ws";
import { ConnectionStatus } from "./connectionStatus";
import { startLoopbackListener } from "./listenerStartup";
import { isChatPromptRequest, PendingEditorWaits, scheduleEditorWaitTimeout, validateWorkspaceRequest, WorkspaceSyncState } from "@codaigram/bridge-protocol";
import type { WorkspaceFolderInfo, WorkspaceSyncRequest } from "@codaigram/bridge-protocol";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { CodexRuntime } from "./codexRuntime";
import type { CodexPromptOptions, CodexRuntimeErrorT } from "./codexRuntime";
import type { CodexNotification } from "./codexRpc";
import { getTypeCodes, scanForClasses, scanForTests } from "@codaigram/scan-shared";
import type { ScannedClass, TestScanResult } from "@codaigram/scan-shared";

type HttpIncomingMessageT = typeof http.IncomingMessage;
type HttpServerResponseT = typeof http.ServerResponse;
type TokenStateT = "available" | "reserved" | "consumed";
type SessionStateT = "available" | "active";

const host: string = "127.0.0.1";

let output: Result<vscode.OutputChannel, string> = err("Output channel is inactive");
let server: Result<http.Server, string> = err("Server is inactive");
let ipv6ProxyServer: Result<net.Server, string> = err("IPv6 listener is inactive");
let webSocketServer: Result<WebSocketServer, string> = err("WebSocket server is inactive");
let connectionStatus: Result<ConnectionStatus, string> = err("Status is inactive");
interface ClientState {
    readonly editorSubscription: vscode.Disposable;
    readonly pendingEditorWaits: PendingEditorWaits;
    readonly pendingChats: Set<string>;
}
const clients: Map<WebSocket, ClientState> = new Map<WebSocket, ClientState>();
const sessionStates: Map<string, SessionStateT> = new Map<string, SessionStateT>();
const sessionIdByClient: Map<WebSocket, string> = new Map<WebSocket, string>();
    const sessionClientById: Map<string, WebSocket> = new Map<string, WebSocket>();
const workspaceSync: WorkspaceSyncState = new WorkspaceSyncState();

export function configuredAgentsForWorkspaceFolder(folder: Pick<vscode.WorkspaceFolder, "uri">): readonly string[] {
    if (folder.uri.scheme !== "file") return [];
    const agents: string[] = [];
    if (existsSync(path.join(folder.uri.fsPath, "AGENTS.md"))) agents.push("codex");
    if (existsSync(path.join(folder.uri.fsPath, "CLAUDE.md"))) agents.push("claude");
    if (existsSync(path.join(folder.uri.fsPath, "AGENT.md"))) agents.push("grok");
    return agents;
}

function currentWorkspaceFolders(): readonly WorkspaceFolderInfo[] {
    const configured: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    const folders: readonly vscode.WorkspaceFolder[] = configured ? configured : [];
    return folders.map((folder, index) => {
        return {
          name: folder.name,
          uri: folder.uri.toString(),
          index,
          configuredAgents: configuredAgentsForWorkspaceFolder(folder)
        };
    });
}

export interface CodAIgramBridgeApi {
    readonly port: number;
    readonly token: string;
    readonly getWorkspaceFolders: () => readonly WorkspaceFolderInfo[];
    readonly getWorkspaceSyncTimestamp: () => number;
    readonly startCodex: () => Promise<Result<void, CodexRuntimeErrorT>>;
    readonly stopCodex: () => Promise<boolean>;
    readonly restartCodex: () => Promise<Result<void, CodexRuntimeErrorT>>;
  readonly scanForTests: (workFolders: readonly string[]) => TestScanResult;
  readonly scanForClasses: (workFolders: readonly string[]) => readonly ScannedClass[];
}

let codexRuntime: CodexRuntime | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<CodAIgramBridgeApi> {
    const activeCodexRuntime: CodexRuntime = new CodexRuntime();
    codexRuntime = activeCodexRuntime;
    let token: string = randomBytes(32).toString("base64url");
    let tokenState: TokenStateT = "available";
    const usedNonces: string[] = [];
    const activeOutput: vscode.OutputChannel = vscode.window.createOutputChannel("CodAIgram Bridge");
    output = ok(activeOutput);
    activeOutput.appendLine("CodAIgram Bridge activating.");
    const activeStatus: ConnectionStatus = new ConnectionStatus(vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100));
    connectionStatus = ok(activeStatus);
    context.subscriptions.push(activeStatus);
    const workspaceSubscription: vscode.Disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        const syncTimestamp: number = workspaceSync.changed();
        clients.forEach((_state: ClientState, client: WebSocket) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ version: 1, type: "workspace_changed", syncTimestamp }));
            }
        });
    });
    context.subscriptions.push(workspaceSubscription);

    context.subscriptions.push(vscode.commands.registerCommand("codaigram-bridge.showConnectionUrl", async () => {
        if (server.isErr()) return;
        const address: ReturnType<http.Server["address"]> = server.value.address();
        if (!address || typeof address === "string") {
            return;
        }

        const connectionUrl: string = `ws://localhost:${address.port}/${token}`;
        const inputBox: vscode.InputBox = vscode.window.createInputBox();
        const copyButton: vscode.QuickInputButton = {
          iconPath: new vscode.ThemeIcon("copy"),
          tooltip: "Copy Connection URL"
        };
        inputBox.title = "CodAIgram Bridge";
        inputBox.prompt = "Copy this URL into CodAIgram to connect to this VS Code window.";
        inputBox.value = connectionUrl;
        inputBox.ignoreFocusOut = true;
        inputBox.buttons = [copyButton];
        const preventEditing: vscode.Disposable = inputBox.onDidChangeValue(() => {
            inputBox.value = connectionUrl;
        });
        const copyOnClick: vscode.Disposable = inputBox.onDidTriggerButton(async (button) => {
            if (button === copyButton) {
                await vscode.commands.executeCommand("codaigram-bridge.copyConnectionUrl");
            }
        });
        inputBox.onDidHide(() => {
            preventEditing.dispose();
            copyOnClick.dispose();
            inputBox.dispose();
        });
        inputBox.show();
    }));

    context.subscriptions.push(vscode.commands.registerCommand("codaigram-bridge.copyConnectionUrl", async () => {
        if (server.isErr()) return;
        const address: ReturnType<http.Server["address"]> = server.value.address();
        if (!address || typeof address === "string") {
            return;
        }

        const connectionUrl: string = `ws://localhost:${address.port}/${token}`;
        await vscode.env.clipboard.writeText(connectionUrl);
        void vscode.window.showInformationMessage("CodAIgram Bridge connection URL copied.");
        return connectionUrl;
    }));

    context.subscriptions.push(vscode.commands.registerCommand("codaigram-bridge.regenerateToken", async () => {
        if (clients.size > 0) {
            void vscode.window.showInformationMessage("Disconnect CodAIgram before generating a new connection token.");
            return;
        }

        token = randomBytes(32).toString("base64url");
        tokenState = "available";
        void vscode.window.showInformationMessage("CodAIgram Bridge connection token regenerated.");
    }));

    const httpServer: http.Server<HttpIncomingMessageT, HttpServerResponseT> = http.createServer((request, response) => {
        if (request.method !== "GET") {
            response.writeHead(405);
            response.end("Method Not Allowed");
            return;
        }

        response.writeHead(404);
        response.end("Not Found");
    });

    const wsServer: WebSocketServer = new WebSocketServer({ noServer: true, maxPayload: 65_536 });
    webSocketServer = ok(wsServer);
    wsServer.on("connection", (client) => {
        const sessionId: string | undefined = sessionIdByClient.get(client);
        sessionIdByClient.delete(client);
        const pendingEditorWaits: PendingEditorWaits = new PendingEditorWaits((id) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ version: 1, type: "error", id, code: "request_timeout" }));
            }
        }, scheduleEditorWaitTimeout);
        const editorSubscription: vscode.Disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (client.readyState === WebSocket.OPEN) {
                const hasActiveEditor: boolean = Boolean(editor);
                const completedIds: string[] = pendingEditorWaits.takeAll();
                client.send(JSON.stringify({
                  version: 1,
                  type: "active_editor_changed",
                  hasActiveEditor
                }));
                completedIds.forEach((id) => {
                    client.send(JSON.stringify({
                      version: 1,
                      type: "active_editor_change",
                      id,
                      hasActiveEditor
                    }));
                });
            }
        });
        const state: ClientState = {
          editorSubscription,
          pendingEditorWaits,
          pendingChats: new Set<string>()
        };
        clients.set(client, state);
        if (connectionStatus.isOk()) connectionStatus.value.connected();
        if (output.isOk()) output.value.appendLine("CodAIgram Bridge WebSocket client connected.");
        client.once("close", () => {
            pendingEditorWaits.clear();
            state.pendingChats.clear();
            editorSubscription.dispose();
            clients.delete(client);
            if (sessionId) sessionStates.set(sessionId, "available");
            if (sessionId && sessionClientById.get(sessionId) === client) sessionClientById.delete(sessionId);
            if (connectionStatus.isOk()) connectionStatus.value.disconnected();
            if (clients.size === 0) {
                token = randomBytes(32).toString("base64url");
                tokenState = "available";
            }
            if (output.isOk()) output.value.appendLine("CodAIgram Bridge WebSocket client disconnected.");
        });
        client.on("error", (error) => {
            if (output.isOk()) output.value.appendLine(`CodAIgram Bridge WebSocket client error: ${error.message}`);
        });
        let messageQueue: Promise<void> = Promise.resolve();
        client.on("message", (data, isBinary) => {
            if (isBinary) return;
            const message: string = data.toString();
            messageQueue = messageQueue.then(() => validateWorkspaceRequest(message)).then((result) => {
                if (result.isOk() && client.readyState === WebSocket.OPEN) {
                    const request: WorkspaceSyncRequest = result.value;
                    if (pendingEditorWaits.has(request.id)) {
                        pendingEditorWaits.clear();
                        client.close(1008);
                    } else if (request.type === "ping") {
                        client.send(JSON.stringify({ version: 1, type: "pong", id: request.id }));
                    } else if (request.type === "workspace_folders") {
                        client.send(JSON.stringify({
                          version: 1,
                          type: "workspace_folders",
                          id: request.id,
                          syncTimestamp: workspaceSync.currentTimestamp(),
                          folders: currentWorkspaceFolders()
                        }));
                    } else if ((request.type === "scan/tests" || request.type === "scan/classes") && Array.isArray(request.workFolders)) {
                        const scanResult: TestScanResult | readonly ScannedClass[] = request.type === "scan/tests" ? scanForTests(request.workFolders) : scanForClasses(request.workFolders);
                        client.send(JSON.stringify({
                          version: 1,
                          type: request.type === "scan/tests" ? "scan_tests_response" : "scan_classes_response",
                          id: request.id,
                          result: scanResult
                        }));
                    } else if (request.type === "code/get" && typeof request.projectName === "string" && Array.isArray(request.workFolders) && typeof request.filepath === "string" && typeof request.typeName === "string") {
                        const matchingCode: readonly string[] = getTypeCodes(request.workFolders, request.filepath, request.typeName);
                        if (matchingCode.length === 0) {
                            client.send(JSON.stringify({
                              version: 1,
                              type: "error",
                              id: request.id,
                              code: "code_not_found"
                            }));
                        } else {
                            const code: string | readonly string[] = matchingCode.length === 1 ? matchingCode[0]! : matchingCode;
                            client.send(JSON.stringify({
                              version: 1,
                              type: "code_response",
                              id: request.id,
                              projectName: request.projectName,
                              code
                            }));
                        }
                    } else if (isChatPromptRequest(request) && request.syncTimestamp !== workspaceSync.currentTimestamp()) {
                        client.send(JSON.stringify({
                          version: 1,
                          type: "error",
                          id: request.id,
                          code: "workspace_sync_required",
                          syncTimestamp: workspaceSync.currentTimestamp(),
                          required: ["workspace_folders"]
                        }));
                    } else if (isChatPromptRequest(request)) {
                        const state: ClientState | undefined = clients.get(client);
                        if (state) {
                            state.pendingChats.add(request.id);
                            void handlePrompt(client, state, request.id, request.prompt, activeCodexRuntime, { cwd: request.cwd, workFolders: request.workFolders });
                        }
                    } else if (request.type === "cancel" && typeof request.targetId === "string") {
                        const targetId: string = request.targetId;
                        const state: ClientState | undefined = clients.get(client);
                        if (pendingEditorWaits.delete(targetId)) {
                            client.send(JSON.stringify({ version: 1, type: "cancelled", id: request.id, targetId }));
                            client.send(JSON.stringify({
                              version: 1,
                              type: "error",
                              id: targetId,
                              code: "request_cancelled"
                            }));
                        } else if (state && state.pendingChats.has(targetId)) {
                            void activeCodexRuntime.cancel().then((cancelled) => {
                                if (client.readyState !== WebSocket.OPEN) return;
                                if (cancelled.isOk()) {
                                    state.pendingChats.delete(targetId);
                                    const cancelledMessage: object = { version: 1, type: "cancelled", id: request.id, targetId };
                                    const completedMessage: object = {
                                      version: 1,
                                      type: "error",
                                      id: targetId,
                                      code: "request_cancelled"
                                    };
                                    client.send(JSON.stringify(cancelledMessage));
                                    client.send(JSON.stringify(completedMessage));
                                } else {
                                    const failedCancellation: object = {
                                      version: 1,
                                      type: "error",
                                      id: request.id,
                                      code: "request_not_pending"
                                    };
                                    client.send(JSON.stringify(failedCancellation));
                                }
                            });
                        } else {
                            client.send(JSON.stringify({
                              version: 1,
                              type: "error",
                              id: request.id,
                              code: "request_not_pending"
                            }));
                        }
                    } else if (request.type === "wait_for_active_editor_change") {
                        if (pendingEditorWaits.size >= 32) {
                            client.send(JSON.stringify({
                              version: 1,
                              type: "error",
                              id: request.id,
                              code: "too_many_pending_requests"
                            }));
                        } else {
                            pendingEditorWaits.add(request.id);
                        }
                    } else {
                        client.send(JSON.stringify({
                          version: 1,
                          type: "error",
                          id: request.id,
                          code: "unsupported_request"
                        }));
                    }
                }
            }).then(() => {}, (error: unknown) => logWarning(error));
        });
        client.send(JSON.stringify({ version: 1, type: "welcome" }));
        if (sessionId) client.send(JSON.stringify({ version: 1, type: "session", sessionId }));
    });
    wsServer.on("error", (error) => {
        if (output.isOk()) output.value.appendLine(`CodAIgram Bridge WebSocket server error: ${error.message}`);
    });
    httpServer.on("upgrade", (request, socket, head) => {
        type CredentialRouteT = "nonce" | "sessionid" | "unknown";
        const rejectUnauthorized: (reason: string, route: CredentialRouteT) => void = (reason, route) => {
            if (output.isOk()) output.value.appendLine(`FAILED WebSocket connection rejected; route=${route}; reason=${reason}.`);
            socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
            socket.destroy();
        };
        const listeningAddress: ReturnType<http.Server["address"]> = httpServer.address();
        if (!listeningAddress || typeof listeningAddress === "string") {
            rejectUnauthorized("listener-address-unavailable", "unknown");
            return;
        }
        const expectedPort: number = listeningAddress.port;
        const requestPath: string = request.url ?? "/";
        const route: CredentialRouteT = requestPath.startsWith("/session/") ? "sessionid" : "nonce";
        const suppliedHost: string | undefined = request.headers.host;
        if (typeof suppliedHost !== "string" ||
            (suppliedHost !== `localhost:${expectedPort}` && suppliedHost !== `127.0.0.1:${expectedPort}`)) {
            if (output.isOk()) output.value.appendLine(`FAILED Host validation; attemptedHost=${typeof suppliedHost === "string" ? suppliedHost : "<missing>"}; expectedHost=localhost:${expectedPort} or 127.0.0.1:${expectedPort}.`);
            rejectUnauthorized("invalid-host", route);
            return;
        }

        const suppliedOrigin: string | undefined = request.headers.origin;
        const trustedOrigins: string[] = vscode.workspace.getConfiguration("codaigramBridge").get<string[]>("trustedOrigins", []);
        if (typeof suppliedOrigin !== "string" || !isAllowedOrigin(suppliedOrigin, trustedOrigins)) {
            const attemptedOrigin: string = typeof suppliedOrigin === "string" ? suppliedOrigin : "<missing>";
            const allowedOrigins: string = trustedOrigins.length > 0 ? trustedOrigins.join(", ") : "<empty>";
            if (output.isOk()) output.value.appendLine(`FAILED Origin validation; attemptedOrigin=${attemptedOrigin}; allowedOrigins=${allowedOrigins}; reason=${typeof suppliedOrigin !== "string" ? "missing-Origin-header" : "origin-not-in-codaigramBridge.trustedOrigins"}; action=edit the VS Code setting codaigramBridge.trustedOrigins.`);
            rejectUnauthorized("untrusted-origin", route);
            return;
        }

        if (!URL.canParse(requestPath, `ws://${host}`)) {
            rejectUnauthorized("invalid-request-url", route);
            return;
        }
        const requestUrl: URL = new URL(requestPath, `ws://${host}`);
        const suppliedToken: string = requestUrl.pathname.startsWith("/") ? requestUrl.pathname.slice(1) : requestUrl.pathname;
        const expected: Buffer<ArrayBuffer> = Buffer.from(token, "utf8");
        const supplied: Buffer<ArrayBuffer> = Buffer.from(suppliedToken, "utf8");
        const tokenMatches: boolean = supplied.length === expected.length && timingSafeEqual(supplied, expected);
        const isNonceRoute: boolean = requestUrl.pathname === `/${token}` && tokenMatches && tokenState === "available";
        const sessionPrefix: string = "/session/";
        const suppliedSessionId: string = requestUrl.pathname.startsWith(sessionPrefix) ? requestUrl.pathname.slice(sessionPrefix.length) : "";
        // UNTRUST-ALLOW-NULLISH: A missing session mapping means no prior socket exists; the explicit undefined
        // value is required to distinguish an active session from a socket that has already begun closing.
        const sessionClient: WebSocket | undefined = sessionClientById.get(suppliedSessionId);
        // UNTRUST-ALLOW-NULLISH: The undefined check is an intentional lookup guard; only a mapped socket can prove that a session is reconnectable while its previous connection is closing, and no absent mapping may be dereferenced while validating an untrusted reconnect request.
        const sessionDisconnected: boolean = sessionClient !== undefined && sessionClient.readyState !== WebSocket.OPEN;
        // UNTRUST-ALLOW-NULLISH: The session-state lookup intentionally returns undefined for unknown credentials;
        // that value is treated as a rejection and is never used as an object or identifier by the upgrade path.
        const isSessionRoute: boolean = suppliedSessionId.length > 0 &&
            (sessionStates.get(suppliedSessionId) === "available" || sessionDisconnected);
        if (!isNonceRoute && !isSessionRoute) {
            if (route === "sessionid") {
                if (output.isOk()) output.value.appendLine(`FAILED sessionid authentication; attemptedSessionId=${suppliedSessionId}; reason=invalid-or-unavailable-sessionid.`);
                rejectUnauthorized("invalid-or-unavailable-sessionid", route);
            } else {
                const wasRecentlyUsed: boolean = usedNonces.includes(suppliedToken);
                // TEMPORARY DIAGNOSTIC: credential values are intentionally printed to diagnose local pairing failures.
                if (output.isOk()) output.value.appendLine(`FAILED nonce authentication; attemptedNonce=${suppliedToken}; requiredNonce=${token}; alreadyUsed=${wasRecentlyUsed}.`);
                rejectUnauthorized(wasRecentlyUsed ? "nonce-already-used" : "invalid-or-unavailable-nonce", route);
            }
            return;
        }

        const sessionId: string = isSessionRoute ? suppliedSessionId : randomBytes(32).toString("base64url");
        sessionStates.set(sessionId, "active");
        if (sessionDisconnected) sessionClientById.delete(sessionId);
        if (isNonceRoute) tokenState = "reserved";
        let upgradeCompleted: boolean = false;
        socket.once("close", () => {
            if (!upgradeCompleted && isNonceRoute && tokenState === "reserved") tokenState = "available";
            if (!upgradeCompleted) sessionStates.set(sessionId, "available");
        });
        try {
            wsServer.handleUpgrade(request, socket, head, (client) => {
                upgradeCompleted = true;
                if (isNonceRoute) {
                    tokenState = "consumed";
                    usedNonces.push(token);
                    if (usedNonces.length > 10) usedNonces.shift();
                }
                sessionIdByClient.set(client, sessionId);
                sessionClientById.set(sessionId, client);
                if (output.isOk()) output.value.appendLine(`CodAIgram Bridge authenticated a WebSocket client; route=${isSessionRoute ? "sessionid" : "nonce"}.`);
                wsServer.emit("connection", client, request);
            });
        } catch (error: unknown) {
            logWarning(error);
            if (isNonceRoute) tokenState = "available";
            sessionStates.set(sessionId, "available");
            socket.destroy();
        }
    });

    server = ok(httpServer);
    let listeningAddress: AddressInfo;
    try {
        listeningAddress = await startLoopbackListener(httpServer);
        const ipv6Proxy: net.Server = net.createServer((client) => {
            const upstream: net.Socket = net.connect(listeningAddress.port, host);
            client.on("error", () => upstream.destroy());
            upstream.on("error", () => client.destroy());
            client.pipe(upstream);
            upstream.pipe(client);
        });
        await new Promise<void>((resolve, reject) => {
            const onError: (error: Error) => void = (error) => {
                ipv6Proxy.removeListener("listening", onListening);
                reject(error);
            };
            const onListening: () => void = () => {
                ipv6Proxy.removeListener("error", onError);
                resolve();
            };
            ipv6Proxy.once("error", onError);
            ipv6Proxy.once("listening", onListening);
            ipv6Proxy.listen(listeningAddress.port, "::1");
        });
        ipv6ProxyServer = ok(ipv6Proxy);
    } catch (error: unknown) {
        logWarning(error);
        if (ipv6ProxyServer.isOk()) {
            ipv6ProxyServer.value.close();
            ipv6ProxyServer = err("IPv6 listener is inactive");
        }
        server = err("Server is inactive");
        webSocketServer = err("WebSocket server is inactive");
        if (connectionStatus.isOk()) connectionStatus.value.dispose();
        connectionStatus = err("Status is inactive");
        wsServer.close();
        if (output.isOk()) output.value.dispose();
        output = err("Output channel is inactive");
        // UNTRUST-ALLOW-UNLOGGED-THROW: The caught listener failure was recorded without its potentially sensitive details above; rethrowing preserves activation failure for the host.
        throw error;
    }

    if (output.isOk()) output.value.appendLine(`CodAIgram Bridge listening on ws://${host}:${listeningAddress.port}`);
    return {
      port: listeningAddress.port,
      get token() {
            return token;
        },
      getWorkspaceFolders: () => currentWorkspaceFolders(),
      getWorkspaceSyncTimestamp: () => workspaceSync.currentTimestamp(),
      startCodex: () => activeCodexRuntime.start({
        name: "codaigram_bridge",
        title: "CodAIgram Bridge",
        version: "0.0.1"
      }),
      stopCodex: () => activeCodexRuntime.stop(),
      restartCodex: () => activeCodexRuntime.restart({
        name: "codaigram_bridge",
        title: "CodAIgram Bridge",
        version: "0.0.1"
      }),
      scanForTests,
      scanForClasses
    };
}

function isAllowedOrigin(suppliedOrigin: string, trustedOrigins: readonly string[]): boolean {
    if (!URL.canParse(suppliedOrigin)) {
        return false;
    }
    const parsedOrigin: URL = new URL(suppliedOrigin);
    if ((parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") ||
        parsedOrigin.origin !== suppliedOrigin || parsedOrigin.username !== "" || parsedOrigin.password !== "") {
        return false;
    }
    return trustedOrigins.some((trustedOrigin) => {
        if (trustedOrigin === suppliedOrigin) return true;
        if (!trustedOrigin.endsWith(":*")) return false;
        const wildcardBase: string = trustedOrigin.slice(0, -2);
        if (!URL.canParse(`${wildcardBase}:0`)) return false;
        const parsedTrusted: URL = new URL(`${wildcardBase}:0`);
        if (parsedTrusted.username !== "" || parsedTrusted.password !== "" || parsedTrusted.pathname !== "/" ||
            parsedTrusted.search !== "" || parsedTrusted.hash !== "") return false;
        return parsedTrusted.protocol === parsedOrigin.protocol && parsedTrusted.hostname === parsedOrigin.hostname;
    });
}

function logWarning(error: unknown): void {
    if (output.isOk()) {
        output.value.appendLine(error instanceof Error ? "CodAIgram Bridge operation failed with an error." : "CodAIgram Bridge operation failed with a non-error value.");
    }
}

async function handlePrompt(client: WebSocket, state: ClientState, id: string, prompt: string, runtime: CodexRuntime, options: CodexPromptOptions = {}): Promise<void> {
    const onDelta: (delta: string) => void = (delta) => {
        const message: object = { version: 1, type: "chat_delta", id, delta };
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
    };
    const onEvent: (notification: CodexNotification) => void = (notification) => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({
          version: 1,
          type: "chat_event",
          id,
          event: notification.method,
          data: notification.params
        }));
    };
    let response: Result<string, CodexRuntimeErrorT> = await runtime.ask(prompt, onDelta, onEvent, options);
    if (response.isErr() && response.error === "not_running") {
        const started: Result<void, CodexRuntimeErrorT> = await runtime.start({
          name: "codaigram_bridge",
          title: "CodAIgram Bridge",
          version: "0.0.1"
        }, options);
        if (started.isErr()) {
            response = err(started.error);
        } else {
            response = await runtime.ask(prompt, onDelta, onEvent, options);
        }
    }
    if (!state.pendingChats.has(id)) return;
    state.pendingChats.delete(id);
    if (client.readyState !== WebSocket.OPEN) return;
    if (response.isOk()) {
        client.send(JSON.stringify({
          version: 1,
          type: "chat_response",
          id,
          response: response.value
        }));
    } else {
        if (output.isOk()) logChatRequestFailure(id, response.error);
        client.send(JSON.stringify({
          version: 1,
          type: "error",
          id,
          code: "codex_request_failed",
          cause: response.error
        }));
    }
}

function logChatRequestFailure(requestId: string, errorCode: CodexRuntimeErrorT): void {
    if (output.isErr()) return;
    const workspaceFolders: readonly WorkspaceFolderInfo[] = currentWorkspaceFolders();
    const workspaceDetails: readonly WorkspaceLogDetails[] = workspaceFolders.map((folder) => ({ name: folder.name, uri: folder.uri }));
    const timestamp: string = new Date().toISOString();
    const reason: string = describeChatFailure(errorCode, workspaceFolders.length);
    output.value.appendLine(`[${timestamp}] CodAIgram Bridge chat request failed; requestId=${requestId}; code=${errorCode}; reason=${reason}; workspaceFolders=${JSON.stringify(workspaceDetails)}`);
}

interface WorkspaceLogDetails {
    readonly name: string;
    readonly uri: string;
}

function describeChatFailure(errorCode: CodexRuntimeErrorT, workspaceCount: number): string {
    if (errorCode === "ambiguous_workspace") return `Codex needs exactly one workspace folder, but VS Code has ${workspaceCount}`;
    if (errorCode === "no_workspace") return "Codex needs exactly one workspace folder, but VS Code has none";
    if (errorCode === "unsupported_workspace_uri") return "Codex needs a local file-backed workspace folder";
    return "Codex runtime could not complete the request; see code for the failed stage";
}

export async function deactivate(): Promise<void> {
    const runtime: CodexRuntime | undefined = codexRuntime;
    if (runtime) await runtime.stop();
    // UNTRUST-ALLOW-NULLISH: Deactivation clears the extension-owned runtime after its stop promise has completed, preventing reuse after shutdown and ensuring later activation creates a fresh owner.
    codexRuntime = undefined;
    if (connectionStatus.isOk()) connectionStatus.value.dispose();
    connectionStatus = err("Status is inactive");
    const webSocketServerToClose: Result<WebSocketServer, string> = webSocketServer;
    webSocketServer = err("WebSocket server is inactive");
    clients.forEach((state, client) => {
        state.pendingEditorWaits.clear();
        state.editorSubscription.dispose();
        client.terminate();
    });
    clients.clear();
    sessionStates.clear();
    sessionIdByClient.clear();
    sessionClientById.clear();
    if (webSocketServerToClose.isOk()) {
        await new Promise<void>((resolve) => {
            webSocketServerToClose.value.close(() => resolve());
        });
    }

    const serverToClose: Result<http.Server, string> = server;
    server = err("Server is inactive");

    const ipv6ProxyToClose: Result<net.Server, string> = ipv6ProxyServer;
    ipv6ProxyServer = err("IPv6 listener is inactive");
    if (ipv6ProxyToClose.isOk()) {
        await new Promise<void>((resolve) => {
            ipv6ProxyToClose.value.close(() => resolve());
        });
    }

    if (serverToClose.isOk()) {
        await new Promise<void>((resolve) => {
            serverToClose.value.close((error) => {
                if (error) {
                    if (output.isOk()) output.value.appendLine(`CodAIgram Bridge failed to close its server: ${error.message}`);
                }
                resolve();
            });
        });
        if (output.isOk()) output.value.appendLine("CodAIgram Bridge server stopped.");
    }

    if (output.isOk()) output.value.dispose();
    output = err("Output channel is inactive");
}
