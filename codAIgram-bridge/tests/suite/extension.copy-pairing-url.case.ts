import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import * as vscode from "vscode";
import NodeWebSocket from "ws";

import { fixedPort, trustedOrigin, request, rejectUpgrade, upgradeStatus, connectWebSocket, closeWebSocket, waitForFile } from "./extension.helpers";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "copies the active pairing URL to the clipboard",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerCopyPairingUrlCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            const copiedUrl: string = await vscode.commands.executeCommand("codaigram-bridge.copyConnectionUrl") as string;
            assert.strictEqual(copiedUrl, `ws://localhost:${api.port}/${api.token}`);
            const socket: NodeWebSocket = new NodeWebSocket(copiedUrl, { headers: { Origin: trustedOrigin } });
            const welcome: string = await new Promise<string>((resolve, reject) => {
                socket.once("message", (data) => resolve(data.toString()));
                socket.once("error", reject);
            });
            assert.deepStrictEqual(JSON.parse(welcome), { version: 1, type: "welcome" });
            await closeWebSocket(socket);
        });
}
