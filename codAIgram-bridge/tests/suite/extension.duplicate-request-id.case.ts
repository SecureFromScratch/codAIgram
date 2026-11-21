import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import type { RawData } from "ws";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "closes on duplicate pending IDs without ambiguous responses",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Close on a duplicate pending request ID without sending an ambiguous error." }]
  }
};

function nextMessage(connection: ConnectedWebSocket): Promise<string> {
    return new Promise((resolve) => connection.socket.once("message", (data: RawData) => resolve(data.toString())));
}

function closedWithoutMessages(connection: ConnectedWebSocket): Promise<number> {
    return new Promise((resolve, reject) => {
        const timeout: NodeJS.Timeout = setTimeout(() => reject(new Error("Expected duplicate ID to close the connection.")), 2_000);
        const messages: string[] = [];
        connection.socket.on("message", (data: RawData) => messages.push(data.toString()));
        connection.socket.once("close", (code: number) => {
            clearTimeout(timeout);
            if (messages.length > 0) {
                reject(new Error("Unexpected response before duplicate ID close."));
            } else {
                resolve(code);
            }
        });
    });
}

export function registerDuplicateRequestIdCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const types: string[] = ["ping", "cancel"];
        for (let index: number = 0; index < types.length; index += 1) {
            const type: string = types[index];
            const oldToken: string = api.token;
            const connection: ConnectedWebSocket = await connectWebSocket(api.port, oldToken);
            try {
                assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
                const barrier: Promise<string> = nextMessage(connection);
                connection.socket.send(JSON.stringify({
                  version: 1,
                  type: "wait_for_active_editor_change",
                  id: "duplicate"
                }));
                connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "barrier" }));
                assert.deepStrictEqual(JSON.parse(await barrier), { version: 1, type: "pong", id: "barrier" });
                const closed: Promise<number> = closedWithoutMessages(connection);
                if (type === "cancel") {
                    connection.socket.send(JSON.stringify({ version: 1, type, id: "duplicate", targetId: "duplicate" }));
                } else {
                    connection.socket.send(JSON.stringify({ version: 1, type, id: "duplicate" }));
                }
                assert.strictEqual(await closed, 1008);
            } finally {
                await closeWebSocket(connection.socket);
            }
            for (let attempt: number = 0; attempt < 40 && api.token === oldToken; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            assert.notStrictEqual(api.token, oldToken);
        }
        const next: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await next.firstMessage), { version: 1, type: "welcome" });
            const response: Promise<string> = nextMessage(next);
            next.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "check",
              targetId: "duplicate"
            }));
            assert.deepStrictEqual(JSON.parse(await response), {
              version: 1,
              type: "error",
              id: "check",
              code: "request_not_pending"
            });
        } finally {
            await closeWebSocket(next.socket);
        }
    });
}
