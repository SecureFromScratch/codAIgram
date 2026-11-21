import * as assert from "node:assert";
import * as vscode from "vscode";
import NodeWebSocket from "ws";
import { createBridgeClient } from "@codaigram/bridge-protocol";
import type { BridgeClient, BridgeSocket } from "@codaigram/bridge-protocol";
import type { BridgeApi } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "gets the current VS Code workspace folders",
  prompt: {
    availability: "unavailable",
    reason: "Client workspace coverage does not require a prompt.",
    history: []
  }
};

export function registerBridgeClientFoldersCase(getApi: () => BridgeApi, trustedOrigin: string): void {
    test(TEST_CASE_METADATA.title, async () => {
        getApi();
        const copiedUrl: string = await vscode.commands.executeCommand("codaigram-bridge.copyConnectionUrl") as string;
        const client: BridgeClient = createBridgeClient(copiedUrl, trustedOrigin, (url, origin) => new NodeWebSocket(url, { headers: { Origin: origin } }) as unknown as BridgeSocket);
        await client.ready;
        const folders: readonly unknown[] = await client.getFolders();
        assert.ok(Array.isArray(folders));
        await client.close();
    });
}
