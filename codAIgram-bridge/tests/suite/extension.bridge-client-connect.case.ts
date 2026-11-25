import * as assert from "node:assert";
import * as vscode from "vscode";
import NodeWebSocket from "ws";
import { createBridgeClient, createBridgeClientForSession } from "@codaigram/bridge-protocol";
import type { BridgeClient, BridgeSocket } from "@codaigram/bridge-protocol";
import type { BridgeApi } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "connects from the copied pairing URL and restores the persistent bridge session",
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
        const sessionId: string = await client.waitForSessionId();
        assert.ok(sessionId.length > 0);
        await client.close();

        const restoredClient: BridgeClient = createBridgeClientForSession(copiedUrl, sessionId, trustedOrigin, (url, origin) => new NodeWebSocket(url, { headers: { Origin: origin } }) as unknown as BridgeSocket);
        await restoredClient.ready;
        assert.equal(await restoredClient.waitForSessionId(), sessionId);
        await restoredClient.getFolders();
        await restoredClient.close();
    });
}
