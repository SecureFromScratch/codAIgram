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
import { supportsHttpsFixture } from "../httpsSupport";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "connects from a trusted HTTPS page to ws localhost",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerHttpsLocalhostWebsocketCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async function () {
            if (!supportsHttpsFixture(process.platform)) {
                this.skip();
            }
            const api: BridgeApi = getApi();
            const browserPath: string | undefined = process.env.CODAIGRAM_BRIDGE_CHROMIUM_PATH;
            const httpsUrl: string | undefined = process.env.CODAIGRAM_BRIDGE_HTTPS_URL;
            assert.ok(browserPath, "A Chromium browser path must be provided for the HTTPS browser test.");
            assert.ok(httpsUrl, "An HTTPS fixture URL must be provided for the browser test.");

            const browser: Browser = await chromium.launch({ executablePath: browserPath, headless: true });
            try {
                const page: Page = await browser.newPage();
                await page.goto(httpsUrl);
                const message: string = await page.evaluate(({ port, token }) => new Promise<string>((resolve, reject) => {
                    const socket: WebSocket = new WebSocket(`ws://localhost:${port}/${token}`);
                    const timeout: NodeJS.Timeout = setTimeout(() => {
                        socket.close();
                        reject(new Error("Timed out waiting for the localhost WebSocket from HTTPS."));
                    }, 5_000);
                    socket.addEventListener("message", (event) => {
                        clearTimeout(timeout);
                        resolve(String(event.data));
                        socket.close();
                    }, { once: true });
                    socket.addEventListener("error", () => {
                        clearTimeout(timeout);
                        reject(new Error("Browser blocked or rejected ws://localhost from HTTPS."));
                    }, { once: true });
                }), { port: api.port, token: api.token });
                assert.deepStrictEqual(JSON.parse(message), { version: 1, type: "welcome" });
            } finally {
                await browser.close();
            }
        });
}
