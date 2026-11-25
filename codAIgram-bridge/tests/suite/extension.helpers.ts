import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import * as vscode from "vscode";
import NodeWebSocket from "ws";
import type { WorkspaceFolderInfo } from "@codaigram/bridge-protocol";

export const websocketTimeoutMs: number = 2_000;
export const fixedPort: number = 11100;
export const trustedOrigin: string = "https://codai.example";

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
    readonly getWorkspaceFolders: () => readonly WorkspaceFolderInfo[];
}

export function request(port: number, method: string): Promise<HttpResult> {
    return new Promise((resolve, reject) => {
        const httpRequest: http.ClientRequest = http.request(`http://127.0.0.1:${port}`, { method }, (response) => {
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
        const headers: http.OutgoingHttpHeaders = {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Key": Buffer.alloc(16).toString("base64"),
          "Sec-WebSocket-Version": "13"
        };
        if (hostHeader.length > 0) headers.Host = hostHeader;
        if (typeof origin === "string") headers.Origin = origin;
        const request: http.ClientRequest = http.request({
          host: "127.0.0.1",
          port,
          path: requestPath,
          setHost: hostHeader.length > 0,
          headers
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
        const headers: http.OutgoingHttpHeaders = {
          Connection: "Upgrade",
          Host: hostHeader,
          Upgrade: "websocket",
          "Sec-WebSocket-Key": Buffer.alloc(16).toString("base64"),
          "Sec-WebSocket-Version": "13"
        };
        if (typeof origin === "string") headers.Origin = origin;
        const request: http.ClientRequest = http.request({ host: "127.0.0.1", port, path: requestPath, headers });
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
        const socket: NodeWebSocket = new NodeWebSocket(`ws://127.0.0.1:${port}/${token}`, { headers: { Origin: origin } });
        const timeout: NodeJS.Timeout = setTimeout(() => {
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
        const timeout: NodeJS.Timeout = setTimeout(() => reject(new Error("Timed out waiting for WebSocket shutdown.")), websocketTimeoutMs);
        socket.addEventListener("close", () => {
            clearTimeout(timeout);
            resolve();
        }, { once: true });
        socket.close();
    });
}

export async function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
    const deadline: number = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (existsSync(filePath)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    // UNTRUST-ALLOW-UNLOGGED-THROW: The integration test framework reports this timeout after the test fails; reporting it here would duplicate that failure and expose fixture paths.
    throw new Error(`Timed out waiting for ${filePath}.`);
}

