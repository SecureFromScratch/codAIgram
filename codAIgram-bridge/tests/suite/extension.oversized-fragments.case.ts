import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "closes with 1009 when fragmented input exceeds 65536 bytes",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Close oversized fragmented inbound WebSocket messages using status code 1009." }]
  }
};

export function registerOversizedFragmentsCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const closed: Promise<number> = new Promise((resolve, reject) => {
                const timeout: NodeJS.Timeout = setTimeout(() => reject(new Error("Timed out waiting for oversize close.")), 3_000);
                connection.socket.once("close", (code) => {
                    clearTimeout(timeout);
                    resolve(code);
                });
                connection.socket.once("error", reject);
            });
            connection.socket.send(" ".repeat(32_768), { fin: false });
            connection.socket.send(" ".repeat(32_769), { fin: true });
            assert.strictEqual(await closed, 1009);
        } finally {
            await closeWebSocket(connection.socket);
        }
    });
}
