import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "accepts an exactly 65536-byte UTF-8 request",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Enforce a 64 KiB inbound message limit and verify the exact byte boundary." }]
  }
};

export function registerMessageSizeBoundaryCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const request: string = JSON.stringify({ version: 1, type: "ping", id: "é" });
            const payload: string = request + " ".repeat(65_536 - Buffer.byteLength(request, "utf8"));
            assert.strictEqual(Buffer.byteLength(payload, "utf8"), 65_536);
            const response: Promise<string> = new Promise((resolve, reject) => {
                const timeout: NodeJS.Timeout = setTimeout(() => reject(new Error("Timed out waiting for boundary response.")), 3_000);
                connection.socket.addEventListener("message", (event) => {
                    clearTimeout(timeout);
                    resolve(String(event.data));
                }, { once: true });
            });
            connection.socket.send(payload);
            assert.deepStrictEqual(JSON.parse(await response), { version: 1, type: "pong", id: "é" });
        } finally {
            await closeWebSocket(connection.socket);
        }
    });
}
