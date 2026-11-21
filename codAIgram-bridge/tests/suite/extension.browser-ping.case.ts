import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import type { BridgeApi } from "./extension.helpers";

interface SessionEnvelope {
    readonly version: number;
    readonly type: string;
    readonly sessionId: string;
}

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "responds to browser pings with correlated pongs",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Add a version 1 ping request and correlated pong response with a client-supplied identifier." }]
  }
};

export function registerBrowserPingCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const browserPath: string | undefined = process.env.CODAIGRAM_BRIDGE_CHROMIUM_PATH;
        const httpUrl: string | undefined = process.env.CODAIGRAM_BRIDGE_HTTP_URL;
        assert.ok(browserPath);
        assert.ok(httpUrl);
        const browser: Browser = await chromium.launch({ executablePath: browserPath, headless: true });
        try {
            const page: Page = await browser.newPage();
            await page.goto(httpUrl);
            const messages: unknown[] = await page.evaluate(({ port, token }) => new Promise<string[]>((resolve, reject) => {
                const socket: WebSocket = new WebSocket(`ws://localhost:${port}/${token}`);
                const timeout: NodeJS.Timeout = setTimeout(() => {
                    socket.close();
                    reject(new Error("Timed out waiting for correlated pongs."));
                }, 3_000);
                const received: string[] = [];
                socket.addEventListener("message", (event) => {
                    received.push(String(event.data));
                    if (received.length === 2) {
                        socket.send(JSON.stringify({ version: 1, type: "ping", id: "first" }));
                        socket.send(JSON.stringify({ version: 1, type: "ping", id: "second" }));
                    } else if (received.length === 4) {
                        clearTimeout(timeout);
                        socket.close();
                        resolve(received);
                    }
                });
                socket.addEventListener("error", () => {
                    clearTimeout(timeout);
                    reject(new Error("Browser WebSocket failed."));
                }, { once: true });
            }), { port: api.port, token: api.token });
            assert.deepStrictEqual(messages.map((message) => JSON.parse(String(message))), [
                { version: 1, type: "welcome" },
                assertSessionMessage(messages[1]),
                { version: 1, type: "pong", id: "first" },
                { version: 1, type: "pong", id: "second" }
            ]);
        } finally {
            await browser.close();
        }
    });
}

function assertSessionMessage(message: unknown): unknown {
    const parsed: SessionEnvelope = JSON.parse(String(message)) as SessionEnvelope;
    assert.deepStrictEqual(Object.keys(parsed).sort(), ["sessionId", "type", "version"]);
    assert.strictEqual(parsed.version, 1);
    assert.strictEqual(parsed.type, "session");
    assert.strictEqual(typeof parsed.sessionId, "string");
    assert.ok(parsed.sessionId);
    return parsed;
}
