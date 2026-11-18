import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import * as vscode from "vscode";
import NodeWebSocket from "ws";

export const websocketTimeoutMs = 2_000;
export const fixedPort = 11100;
export const trustedOrigin: "https://codai.example" = "https://codai.example";

export interface HttpResult {
    readonly body: string;
    readonly headers: http.IncomingHttpHeaders;
    readonly statusCode: number | undefined;
}

export interface ConnectedWebSocket {
    readonly socket: NodeWebSocket;
    readonly firstMessage: Promise<string>;
}

export interface BridgeApi {
    readonly port: number;
    readonly token: string;
}

export function request(port: number, method: string): Promise<HttpResult> {
    return new Promise((resolve, reject) => {
        const httpRequest = http.request(`http://127.0.0.1:${port}`, { method }, (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () => resolve({
                body: Buffer.concat(chunks).toString("utf8"),
                headers: response.headers,
                statusCode: response.statusCode
            }));
        });
        httpRequest.once("error", reject);
        httpRequest.end();
    });
}

export function rejectUpgrade(port: number, requestPath: string, hostHeader = `127.0.0.1:${port}`, origin?: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const request = http.request({
            host: "127.0.0.1",
            port,
            path: requestPath,
            setHost: hostHeader.length > 0,
            headers: {
                Connection: "Upgrade",
                ...(hostHeader.length > 0 ? { Host: hostHeader } : {}),
                ...(typeof origin === "string" ? { Origin: origin } : {}),
                Upgrade: "websocket",
                "Sec-WebSocket-Key": Buffer.alloc(16).toString("base64"),
                "Sec-WebSocket-Version": "13"
            }
        });
        request.once("upgrade", (_response, socket) => {
            socket.destroy();
            reject(new Error(`Expected WebSocket upgrade ${requestPath} to be rejected.`));
        });
        request.once("response", (response) => {
            response.resume();
            response.once("end", () => resolve(response.statusCode ?? 0));
        });
        request.once("error", reject);
        request.end();
    });
}

export function upgradeStatus(port: number, requestPath: string, hostHeader: string, origin?: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const request = http.request({
            host: "127.0.0.1",
            port,
            path: requestPath,
            headers: {
                Connection: "Upgrade",
                Host: hostHeader,
                ...(typeof origin === "string" ? { Origin: origin } : {}),
                Upgrade: "websocket",
                "Sec-WebSocket-Key": Buffer.alloc(16).toString("base64"),
                "Sec-WebSocket-Version": "13"
            }
        });
        request.once("upgrade", (_response, socket) => {
            socket.destroy();
            resolve(101);
        });
        request.once("response", (response) => {
            response.resume();
            response.once("end", () => resolve(response.statusCode ?? 0));
        });
        request.once("error", reject);
        request.end();
    });
}

export function connectWebSocket(port: number, token: string, origin = trustedOrigin): Promise<ConnectedWebSocket> {
    return new Promise((resolve, reject) => {
        const socket = new NodeWebSocket(`ws://127.0.0.1:${port}/${token}`, { headers: { Origin: origin } });
        const timeout = setTimeout(() => {
            socket.close();
            reject(new Error("Timed out waiting for the WebSocket connection to open."));
        }, websocketTimeoutMs);
        const firstMessage: Promise<string> = new Promise<string>((messageResolve, messageReject) => {
            socket.addEventListener("message", (event) => {
                if (typeof event.data !== "string") {
                    messageReject(new Error("Expected the first WebSocket message to be text."));
                    return;
                }
                messageResolve(event.data);
            }, { once: true });
            socket.addEventListener("error", () => messageReject(new Error("WebSocket message failed.")), { once: true });
        });
        socket.addEventListener("open", () => {
            clearTimeout(timeout);
            resolve({ socket, firstMessage });
        }, { once: true });
        socket.addEventListener("error", () => {
            clearTimeout(timeout);
            reject(new Error("WebSocket handshake failed."));
        }, { once: true });
    });
}

export function closeWebSocket(socket: NodeWebSocket): Promise<void> {
    if (socket.readyState === NodeWebSocket.CLOSED) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for WebSocket shutdown.")), websocketTimeoutMs);
        socket.addEventListener("close", () => {
            clearTimeout(timeout);
            resolve();
        }, { once: true });
        socket.close();
    });
}

export async function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            await fs.access(filePath);
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    throw new Error(`Timed out waiting for ${filePath}.`);
}

