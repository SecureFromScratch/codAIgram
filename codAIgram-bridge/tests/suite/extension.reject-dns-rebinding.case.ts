import type { TestCaseMetadata } from "../testCaseMetadata";
import type { Browser, Page, CDPSession } from "playwright-core";
import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import * as vscode from "vscode";
import NodeWebSocket from "ws";

import { fixedPort, trustedOrigin, request, rejectUpgrade, upgradeStatus, connectWebSocket, closeWebSocket, waitForFile } from "./extension.helpers";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "rejects browser-local DNS rebinding and preserves the token",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerRejectDnsRebindingCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            const browserPath: string | undefined = process.env.CODAIGRAM_BRIDGE_CHROMIUM_PATH;
            const httpUrl: string | undefined = process.env.CODAIGRAM_BRIDGE_HTTP_URL;
            assert.ok(browserPath, "A Chromium browser path must be provided for the HTTPS browser test.");
            assert.ok(httpUrl, "The HTTP fixture URL must be provided for the DNS rebinding test.");

            const browser: Browser = await chromium.launch({
              executablePath: browserPath,
              headless: true,
              args: ["--no-proxy-server", "--host-resolver-rules=MAP codaigram-rebind.test 127.0.0.1"]
            });
            try {
                const page: Page = await browser.newPage();
                const cdp: CDPSession = await page.context().newCDPSession(page);
                await cdp.send("Network.enable");
                let suppliedHost: string | undefined;
                cdp.on("Network.webSocketWillSendHandshakeRequest", (event) => {
                    suppliedHost = event.request.headers.Host as string | undefined;
                });
                await page.goto(httpUrl);
                const rebindRejected: boolean = await page.evaluate(({ port, token }) => new Promise<boolean>((resolve) => {
                    const socket: WebSocket = new WebSocket(`ws://codaigram-rebind.test:${port}/${token}`);
                    const timeout: NodeJS.Timeout = setTimeout(() => {
                        socket.close();
                        resolve(false);
                    }, 5_000);
                    socket.addEventListener("open", () => {
                        clearTimeout(timeout);
                        socket.close();
                        resolve(false);
                    }, { once: true });
                    socket.addEventListener("error", () => {
                        clearTimeout(timeout);
                        resolve(true);
                    }, { once: true });
                }), { port: api.port, token: api.token });
                assert.strictEqual(rebindRejected, true, "The fictitious hostname resolving to loopback must be rejected.");
                assert.strictEqual(suppliedHost, `codaigram-rebind.test:${api.port}`, "Chromium must send the fictitious URL hostname in its Host header.");

                const message: string = await page.evaluate(({ port, token }) => new Promise<string>((resolve, reject) => {
                    const socket: WebSocket = new WebSocket(`ws://localhost:${port}/${token}`);
                    const timeout: NodeJS.Timeout = setTimeout(() => {
                        socket.close();
                        reject(new Error("Timed out waiting for the authenticated localhost WebSocket."));
                    }, 5_000);
                    socket.addEventListener("message", (event) => {
                        clearTimeout(timeout);
                        resolve(String(event.data));
                        socket.close();
                    }, { once: true });
                    socket.addEventListener("error", () => {
                        clearTimeout(timeout);
                        reject(new Error("The valid localhost WebSocket was rejected after the DNS rebinding attempt."));
                    }, { once: true });
                }), { port: api.port, token: api.token });
                assert.deepStrictEqual(JSON.parse(message), { version: 1, type: "welcome" });
            } finally {
                await browser.close();
            }
        });
}
