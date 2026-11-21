import * as assert from "node:assert";
import NodeWebSocket from "ws";
import type { TestCaseMetadata } from "../testCaseMetadata";
import type { BridgeApi } from "./extension.helpers";

interface SessionMessage {
    readonly version: number;
    readonly type: string;
    readonly sessionId: string;
}

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "reconnects with the session ID issued after nonce authentication",
  prompt: {
    availability: "unavailable",
    reason: "Session reconnect transport coverage does not require a prompt.",
    history: []
  }
};

export function registerSessionReconnectCase(getApi: () => BridgeApi, trustedOrigin: string): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const initial: NodeWebSocket = new NodeWebSocket(`ws://127.0.0.1:${api.port}/${api.token}`, { headers: { Origin: trustedOrigin } });
        const messages: string[] = [];
        await new Promise<void>((resolve, reject) => {
            initial.on("message", (data) => {
                messages.push(data.toString());
                if (messages.length === 2) resolve();
            });
            initial.once("error", reject);
        });
        assert.deepStrictEqual(JSON.parse(messages[0]), { version: 1, type: "welcome" });
        const sessionMessage: SessionMessage = JSON.parse(messages[1]) as SessionMessage;
        assert.strictEqual(sessionMessage.type, "session");
        assert.ok(sessionMessage.sessionId.length > 0);
        await new Promise<void>((resolve) => {
            initial.once("close", () => resolve());
            initial.close();
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 25));

        const reconnect: NodeWebSocket = new NodeWebSocket(`ws://127.0.0.1:${api.port}/session/${sessionMessage.sessionId}`, { headers: { Origin: trustedOrigin } });
        try {
            const welcome: string = await new Promise<string>((resolve, reject) => {
                reconnect.once("message", (data) => resolve(data.toString()));
                reconnect.once("error", reject);
            });
            assert.deepStrictEqual(JSON.parse(welcome), { version: 1, type: "welcome" });
        } finally {
            await new Promise<void>((resolve) => {
                reconnect.once("close", () => resolve());
                reconnect.close();
            });
        }
    });
}
