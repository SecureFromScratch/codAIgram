import * as assert from "node:assert";
import { WebSocketServer } from "ws";
import NodeWebSocket from "ws";
import { createBridgeClient } from "@codaigram/bridge-protocol";
import type { BridgeClient, BridgeSocket } from "@codaigram/bridge-protocol";
import type { BridgeApi } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "sends a prompt and returns the AI response",
  prompt: {
    availability: "available",
    reason: "The client prompt API is exercised against a deterministic protocol server.",
    history: []
  }
};

export function registerBridgeClientPromptCase(_getApi: () => BridgeApi, trustedOrigin: string): void {
    test(TEST_CASE_METADATA.title, async () => {
        const server: WebSocketServer = new WebSocketServer({ port: 0 });
        await new Promise<void>((resolve) => server.once("listening", () => resolve()));
        const address: ReturnType<WebSocketServer["address"]> = server.address();
        assert.ok(address && typeof address !== "string");
        server.on("connection", (socket) => {
            socket.send(JSON.stringify({ version: 1, type: "welcome" }));
            socket.on("message", (data) => {
                const request: { type: string; id: string } = JSON.parse(data.toString()) as { type: string; id: string };
                if (request.type === "workspace_folders") {
                    socket.send(JSON.stringify({
                      version: 1,
                      type: "workspace_folders",
                      id: request.id,
                      syncTimestamp: 1,
                      folders: []
                    }));
                }
                if (request.type === "chat/ask") {
                    socket.send(JSON.stringify({
                      version: 1,
                      type: "chat_response",
                      id: request.id,
                      response: "Lincoln"
                    }));
                }
            });
        });
        const client: BridgeClient = createBridgeClient(`ws://127.0.0.1:${address.port}/test-token`, trustedOrigin, (url, origin) => new NodeWebSocket(url, { headers: { Origin: origin } }) as unknown as BridgeSocket);
        try {
            await client.ready;
            const response: string = await client.promptAi("Who was the president of the US during the Civil War? Respond with only the family name.");
            assert.strictEqual(response, "Lincoln");
        } finally {
            await client.close();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
}
