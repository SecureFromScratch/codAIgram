import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import type { RawData } from "ws";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "processes consecutive requests in arrival order after invalid frames",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Preserve arrival order through asynchronous validation and dispatch." }]
  }
};

function receive(connection: ConnectedWebSocket, count: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const messages: string[] = [];
        const timeout: NodeJS.Timeout = setTimeout(() => {
            connection.socket.removeListener("message", onMessage);
            reject(new Error("Timed out waiting for ordered responses."));
        }, 3_000);
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

export function registerRequestOrderCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const responses: Promise<string[]> = receive(connection, 3);
            connection.socket.send("not json");
            connection.socket.send(Buffer.from("binary"));
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "wait_for_active_editor_change",
              id: "ordered-wait"
            }));
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "ordered-cancel",
              targetId: "ordered-wait"
            }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "ordered-ping" }));
            assert.deepStrictEqual((await responses).map((message) => JSON.parse(message)), [
                {
                  version: 1,
                  type: "cancelled",
                  id: "ordered-cancel",
                  targetId: "ordered-wait"
                },
                {
                  version: 1,
                  type: "error",
                  id: "ordered-wait",
                  code: "request_cancelled"
                },
                { version: 1, type: "pong", id: "ordered-ping" }
            ]);
        } finally {
            await closeWebSocket(connection.socket);
        }
    });
}
