import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "returns a correlated error for unsupported requests and continues serving pings",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Return a structured correlated error for unsupported requests without reflecting their type." }]
  }
};

export function registerUnsupportedRequestCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const replies: Promise<string[]> = new Promise((resolve, reject) => {
                const received: string[] = [];
                const timeout: NodeJS.Timeout = setTimeout(() => reject(new Error("Timed out waiting for responses.")), 3_000);
                connection.socket.addEventListener("message", (event) => {
                    received.push(String(event.data));
                    if (received.length === 2) {
                        clearTimeout(timeout);
                        resolve(received);
                    }
                });
            });
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "private-unknown-operation",
              id: "request-7"
            }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "request-8" }));
            const responses: string[] = await replies;
            assert.deepStrictEqual(JSON.parse(responses[0]), {
              version: 1,
              type: "error",
              id: "request-7",
              code: "unsupported_request"
            });
            assert.deepStrictEqual(JSON.parse(responses[1]), { version: 1, type: "pong", id: "request-8" });
        } finally {
            await closeWebSocket(connection.socket);
        }
    });
}
