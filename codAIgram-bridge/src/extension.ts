import * as http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import * as vscode from "vscode";
import { WebSocket, WebSocketServer } from "ws";
import { ConnectionStatus } from "./connectionStatus";
import { startLoopbackListener } from "./listenerStartup";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

const host: "127.0.0.1" = "127.0.0.1";

let output: Result<vscode.OutputChannel, string> = err("Output channel is inactive");
let server: Result<http.Server, string> = err("Server is inactive");
let webSocketServer: Result<WebSocketServer, string> = err("WebSocket server is inactive");
let connectionStatus: Result<ConnectionStatus, string> = err("Status is inactive");
const clients: Set<WebSocket> = new Set<WebSocket>();

export interface CodAIgramBridgeApi {
    readonly port: number;
    readonly token: string;
}

export async function activate(context: vscode.ExtensionContext): Promise<CodAIgramBridgeApi> {
    let token = randomBytes(32).toString("base64url");
    let tokenState: "available" | "reserved" | "consumed" = "available";
    const activeOutput = vscode.window.createOutputChannel("CodAIgram Bridge");
    output = ok(activeOutput);
    activeOutput.appendLine("CodAIgram Bridge activating.");
    const activeStatus = new ConnectionStatus(vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100));
    connectionStatus = ok(activeStatus);
    context.subscriptions.push(activeStatus);

    context.subscriptions.push(vscode.commands.registerCommand("codaigram-bridge.showConnectionUrl", async () => {
        if (server.isErr()) return;
        const address = server.value.address();
        if (!address || typeof address === "string") {
            return;
        }

        const connectionUrl = `http://localhost:${address.port}/${token}`;
        const inputBox = vscode.window.createInputBox();
        const copyButton = {
            iconPath: new vscode.ThemeIcon("copy"),
            tooltip: "Copy Connection URL"
        };
        inputBox.title = "CodAIgram Bridge";
        inputBox.prompt = "Copy this URL into CodAIgram to connect to this VS Code window.";
        inputBox.value = connectionUrl;
        inputBox.ignoreFocusOut = true;
        inputBox.buttons = [copyButton];
        const preventEditing = inputBox.onDidChangeValue(() => {
            inputBox.value = connectionUrl;
        });
        const copyOnClick = inputBox.onDidTriggerButton(async (button) => {
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
        const address = server.value.address();
        if (!address || typeof address === "string") {
            return;
        }

        await vscode.env.clipboard.writeText(`http://localhost:${address.port}/${token}`);
        void vscode.window.showInformationMessage("CodAIgram Bridge connection URL copied.");
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

    const httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> = http.createServer((request, response) => {
        if (request.method !== "GET") {
            response.writeHead(405);
            response.end("Method Not Allowed");
            return;
        }

        response.writeHead(404);
        response.end("Not Found");
    });

    const wsServer: WebSocketServer = new WebSocketServer({ noServer: true });
    webSocketServer = ok(wsServer);
    wsServer.on("connection", (client) => {
        clients.add(client);
        if (connectionStatus.isOk()) connectionStatus.value.connected();
        if (output.isOk()) output.value.appendLine("CodAIgram Bridge WebSocket client connected.");
        client.once("close", () => {
            clients.delete(client);
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
        client.send("Hello");
    });
    wsServer.on("error", (error) => {
        if (output.isOk()) output.value.appendLine(`CodAIgram Bridge WebSocket server error: ${error.message}`);
    });
    httpServer.on("upgrade", (request, socket, head) => {
        const rejectUnauthorized = (): void => {
            if (output.isOk()) output.value.appendLine("CodAIgram Bridge rejected an unauthenticated WebSocket connection.");
            socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
            socket.destroy();
        };
        const listeningAddress = httpServer.address();
        if (!listeningAddress || typeof listeningAddress === "string") {
            rejectUnauthorized();
            return;
        }
        const expectedPort = listeningAddress.port;
        const suppliedHost = request.headers.host;
        if (typeof suppliedHost !== "string" ||
            (suppliedHost !== `localhost:${expectedPort}` && suppliedHost !== `127.0.0.1:${expectedPort}`)) {
            rejectUnauthorized();
            return;
        }

        const suppliedOrigin = request.headers.origin;
        const trustedOrigins: string[] = vscode.workspace.getConfiguration("codaigramBridge").get<string[]>("trustedOrigins", []);
        if (typeof suppliedOrigin !== "string" || !isAllowedOrigin(suppliedOrigin, trustedOrigins)) {
            rejectUnauthorized();
            return;
        }

        let requestUrl: URL;
        try {
            requestUrl = new URL(request.url ?? "/", `ws://${host}`);
        } catch {
            rejectUnauthorized();
            return;
        }
        const suppliedToken = requestUrl.pathname.startsWith("/") ? requestUrl.pathname.slice(1) : requestUrl.pathname;
        const expected: Buffer<ArrayBuffer> = Buffer.from(token, "utf8");
        const supplied: Buffer<ArrayBuffer> = Buffer.from(suppliedToken, "utf8");
        const tokenMatches = supplied.length === expected.length && timingSafeEqual(supplied, expected);
        if (requestUrl.pathname !== `/${token}` || !tokenMatches || tokenState !== "available") {
            rejectUnauthorized();
            return;
        }

        tokenState = "reserved";
        let upgradeCompleted = false;
        socket.once("close", () => {
            if (!upgradeCompleted && tokenState === "reserved") {
                tokenState = "available";
            }
        });
        try {
            wsServer.handleUpgrade(request, socket, head, (client) => {
                upgradeCompleted = true;
                tokenState = "consumed";
                if (output.isOk()) output.value.appendLine("CodAIgram Bridge authenticated a WebSocket client.");
                wsServer.emit("connection", client, request);
            });
        } catch (error: unknown) {
            tokenState = "available";
            const message = error instanceof Error ? error.message : String(error);
            if (output.isOk()) output.value.appendLine(`CodAIgram Bridge WebSocket upgrade failed: ${message}`);
            socket.destroy();
        }
    });

    server = ok(httpServer);
    let listeningAddress;
    try {
        listeningAddress = await startLoopbackListener(httpServer);
    } catch (error: unknown) {
        server = err("Server is inactive");
        webSocketServer = err("WebSocket server is inactive");
        if (connectionStatus.isOk()) connectionStatus.value.dispose();
        connectionStatus = err("Status is inactive");
        wsServer.close();
        if (output.isOk()) output.value.appendLine(`CodAIgram Bridge listener failed to start: ${error instanceof Error ? error.message : String(error)}`);
        if (output.isOk()) output.value.dispose();
        output = err("Output channel is inactive");
        throw error;
    }

    if (output.isOk()) output.value.appendLine(`CodAIgram Bridge listening on ws://${host}:${listeningAddress.port}`);
    return {
        port: listeningAddress.port,
        get token() {
            return token;
        }
    };
}

function isAllowedOrigin(suppliedOrigin: string, trustedOrigins: readonly string[]): boolean {
    let parsedOrigin: URL;
    try {
        parsedOrigin = new URL(suppliedOrigin);
    } catch {
        return false;
    }
    if ((parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") ||
        parsedOrigin.origin !== suppliedOrigin || parsedOrigin.username !== "" || parsedOrigin.password !== "") {
        return false;
    }
    return trustedOrigins.some((trustedOrigin) => trustedOrigin === suppliedOrigin);
}

export async function deactivate(): Promise<void> {
    if (connectionStatus.isOk()) connectionStatus.value.dispose();
    connectionStatus = err("Status is inactive");
    const webSocketServerToClose = webSocketServer;
    webSocketServer = err("WebSocket server is inactive");
    for (const client of clients) {
        client.terminate();
    }
    clients.clear();
    if (webSocketServerToClose.isOk()) {
        await new Promise<void>((resolve) => {
            webSocketServerToClose.value.close(() => resolve());
        });
    }

    const serverToClose = server;
    server = err("Server is inactive");

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
