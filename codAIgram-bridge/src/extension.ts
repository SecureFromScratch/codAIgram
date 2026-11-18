import * as http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import * as vscode from "vscode";
import { WebSocket, WebSocketServer } from "ws";
import { ConnectionStatus } from "./connectionStatus";
import { startLoopbackListener } from "./listenerStartup";

const host: "127.0.0.1" = "127.0.0.1";

let output: vscode.OutputChannel | undefined;
let server: http.Server | undefined;
let webSocketServer: WebSocketServer | undefined;
let connectionStatus: ConnectionStatus | undefined;
const clients: Set<WebSocket> = new Set<WebSocket>();

export interface CodAIgramBridgeApi {
    readonly port: number;
    readonly token: string;
}

export async function activate(context: vscode.ExtensionContext): Promise<CodAIgramBridgeApi> {
    let token = randomBytes(32).toString("base64url");
    let tokenState: "available" | "reserved" | "consumed" = "available";
    output = vscode.window.createOutputChannel("CodAIgram Bridge");
    output.appendLine("CodAIgram Bridge activating.");
    connectionStatus = new ConnectionStatus(vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100));
    context.subscriptions.push(connectionStatus);

    context.subscriptions.push(vscode.commands.registerCommand("codaigram-bridge.showConnectionUrl", async () => {
        const activeServer = server;
        const address = activeServer?.address();
        if (address === null || address === undefined || typeof address === "string") {
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
        const address = server?.address();
        if (address === null || address === undefined || typeof address === "string") {
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

    const wsServer: import("C:/Users/yariv/source/Effective/ts/codaigram/codAIgram-bridge/node_modules/@types/ws/index").Server<typeof import("C:/Users/yariv/source/Effective/ts/codaigram/codAIgram-bridge/node_modules/@types/ws/index"), typeof http.IncomingMessage> = new WebSocketServer({ noServer: true });
    webSocketServer = wsServer;
    wsServer.on("connection", (client) => {
        clients.add(client);
        connectionStatus?.connected();
        output?.appendLine("CodAIgram Bridge WebSocket client connected.");
        client.once("close", () => {
            clients.delete(client);
            connectionStatus?.disconnected();
            if (clients.size === 0) {
                token = randomBytes(32).toString("base64url");
                tokenState = "available";
            }
            output?.appendLine("CodAIgram Bridge WebSocket client disconnected.");
        });
        client.on("error", (error) => {
            output?.appendLine(`CodAIgram Bridge WebSocket client error: ${error.message}`);
        });
        client.send("Hello");
    });
    wsServer.on("error", (error) => {
        output?.appendLine(`CodAIgram Bridge WebSocket server error: ${error.message}`);
    });
    httpServer.on("upgrade", (request, socket, head) => {
        const rejectUnauthorized = (): void => {
            output?.appendLine("CodAIgram Bridge rejected an unauthenticated WebSocket connection.");
            socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
            socket.destroy();
        };
        const listeningAddress = httpServer.address();
        const expectedPort = listeningAddress !== null && typeof listeningAddress !== "string"
            ? listeningAddress.port
            : undefined;
        const suppliedHost = request.headers.host;
        if (expectedPort === undefined || typeof suppliedHost !== "string" ||
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
                output?.appendLine("CodAIgram Bridge authenticated a WebSocket client.");
                wsServer.emit("connection", client, request);
            });
        } catch (error: unknown) {
            tokenState = "available";
            const message = error instanceof Error ? error.message : String(error);
            output?.appendLine(`CodAIgram Bridge WebSocket upgrade failed: ${message}`);
            socket.destroy();
        }
    });

    server = httpServer;
    let listeningAddress;
    try {
        listeningAddress = await startLoopbackListener(httpServer);
    } catch (error: unknown) {
        server = undefined;
        webSocketServer = undefined;
        connectionStatus?.dispose();
        connectionStatus = undefined;
        wsServer.close();
        output?.appendLine(`CodAIgram Bridge listener failed to start: ${error instanceof Error ? error.message : String(error)}`);
        output?.dispose();
        output = undefined;
        throw error;
    }

    output?.appendLine(`CodAIgram Bridge listening on ws://${host}:${listeningAddress.port}`);
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
    connectionStatus?.dispose();
    connectionStatus = undefined;
    const webSocketServerToClose = webSocketServer;
    webSocketServer = undefined;
    for (const client of clients) {
        client.terminate();
    }
    clients.clear();
    if (webSocketServerToClose !== undefined) {
        await new Promise<void>((resolve) => {
            webSocketServerToClose.close(() => resolve());
        });
    }

    const serverToClose = server;
    server = undefined;

    if (serverToClose !== undefined) {
        await new Promise<void>((resolve) => {
            serverToClose.close((error) => {
                if (error !== undefined) {
                    output?.appendLine(`CodAIgram Bridge failed to close its server: ${error.message}`);
                }
                resolve();
            });
        });
        output?.appendLine("CodAIgram Bridge server stopped.");
    }

    output?.dispose();
    output = undefined;
}
