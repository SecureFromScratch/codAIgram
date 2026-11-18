import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import * as vscode from "vscode";
import NodeWebSocket from "ws";

import { fixedPort, trustedOrigin, request, rejectUpgrade, upgradeStatus, connectWebSocket, closeWebSocket, waitForFile } from "./extension.helpers";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA = {
  title: "copies the active pairing URL to the clipboard",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerCopyPairingUrlCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api = getApi();
            await vscode.commands.executeCommand("codaigram-bridge.copyConnectionUrl");
            assert.strictEqual(await vscode.env.clipboard.readText(), `http://localhost:${api.port}/${api.token}`);
        });
}
