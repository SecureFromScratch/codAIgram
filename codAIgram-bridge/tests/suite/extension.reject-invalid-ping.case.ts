import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "ignores malformed and invalid ping messages without closing the connection",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Validate the entire inbound ping shape and safely ignore invalid messages." }]
  }
};

export function registerRejectInvalidPingCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const response: Promise<string> = new Promise((resolve, reject) => {
                const timeout: NodeJS.Timeout = setTimeout(() => reject(new Error("Timed out waiting for pong.")), 3_000);
                connection.socket.addEventListener("message", (event) => {
                    clearTimeout(timeout);
                    resolve(String(event.data));
                }, { once: true });
            });
            connection.socket.send("not json");
            connection.socket.send("null");
            connection.socket.send("[]");
            connection.socket.send(JSON.stringify({ version: 2, type: "ping", id: "bad" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "", id: "bad" }));
            connection.socket.send(JSON.stringify({ version: 1, type: 7, id: "bad" }));
            connection.socket.send(JSON.stringify({ version: 1, id: "bad" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "x".repeat(129), id: "bad" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: 1 }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "x".repeat(4097) }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "bad", extra: true }));
            connection.socket.send(Buffer.from('{"version":1,"type":"ping","id":"binary"}'));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "valid" }));
            assert.deepStrictEqual(JSON.parse(await response), { version: 1, type: "pong", id: "valid" });
        } finally {
            await closeWebSocket(connection.socket);
        }
    });
}
