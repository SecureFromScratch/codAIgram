import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import type { RawData } from "ws";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "times out an editor wait and allows its ID to be reused",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Verify the actual server wait timeout and reuse of an expired request ID." }]
  }
};

function receive(connection: ConnectedWebSocket, count: number, delayMs: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const messages: string[] = [];
        const timeout: NodeJS.Timeout = setTimeout(() => {
            connection.socket.removeListener("message", onMessage);
            reject(new Error("Timed out waiting for server response."));
        }, delayMs);
        const onMessage: (data: RawData) => void = (data) => {
            messages.push(data.toString());
            if (messages.length === count) {
                clearTimeout(timeout);
                connection.socket.removeListener("message", onMessage);
                resolve(messages);
            }
        };
        connection.socket.on("message", onMessage);
    });
}

export function registerEditorWaitServerTimeoutCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async function () {
        this.timeout(45_000);
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const response: Promise<string[]> = receive(connection, 1, 38_000);
            const started: number = Date.now();
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "wait_for_active_editor_change",
              id: "timeout-id"
            }));
            assert.deepStrictEqual(JSON.parse((await response)[0]), {
              version: 1,
              type: "error",
              id: "timeout-id",
              code: "request_timeout"
            });
            assert.ok(Date.now() - started >= 29_000, "Production timeout must not fire early.");
            const lateCancellation: Promise<string[]> = receive(connection, 1, 3_000);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "too-late",
              targetId: "timeout-id"
            }));
            assert.deepStrictEqual(JSON.parse((await lateCancellation)[0]), {
              version: 1,
              type: "error",
              id: "too-late",
              code: "request_not_pending"
            });
            const barrier: Promise<string[]> = receive(connection, 1, 3_000);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "wait_for_active_editor_change",
              id: "timeout-id"
            }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "after-timeout" }));
            assert.deepStrictEqual(JSON.parse((await barrier)[0]), { version: 1, type: "pong", id: "after-timeout" });
            const cancellation: Promise<string[]> = receive(connection, 2, 3_000);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "cancel-reused",
              targetId: "timeout-id"
            }));
            assert.deepStrictEqual((await cancellation).map((message) => JSON.parse(message)), [
                {
                  version: 1,
                  type: "cancelled",
                  id: "cancel-reused",
                  targetId: "timeout-id"
                },
                {
                  version: 1,
                  type: "error",
                  id: "timeout-id",
                  code: "request_cancelled"
                }
            ]);
        } finally {
            await closeWebSocket(connection.socket);
        }
    });
}
