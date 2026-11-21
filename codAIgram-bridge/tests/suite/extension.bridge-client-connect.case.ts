import * as assert from "node:assert";
import * as vscode from "vscode";
import NodeWebSocket from "ws";
import { createBridgeClient } from "@codaigram/bridge-protocol";
import type { BridgeClient, BridgeSocket } from "@codaigram/bridge-protocol";
import type { BridgeApi } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "constructs a client from the copied extension URL and connects",
  prompt: {
    availability: "unavailable",
    reason: "Client transport coverage does not require a prompt.",
    history: []
  }
};

export function registerBridgeClientConnectCase(getApi: () => BridgeApi, trustedOrigin: string): void {
    test(TEST_CASE_METADATA.title, async () => {
        getApi();
        const copiedUrl: string = await vscode.commands.executeCommand("codaigram-bridge.copyConnectionUrl") as string;
        const client: BridgeClient = createBridgeClient(copiedUrl, trustedOrigin, (url, origin) => new NodeWebSocket(url, { headers: { Origin: origin } }) as unknown as BridgeSocket);
        await client.ready;
        await client.reconnect();
        assert.ok(client.sessionId);
        await client.close();
    });
}
