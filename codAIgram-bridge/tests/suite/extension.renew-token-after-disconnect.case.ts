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
  title: "generates a fresh token after disconnect and accepts a new session",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerRenewTokenAfterDisconnectCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            await vscode.commands.executeCommand("codaigram-bridge.regenerateToken");
            const disconnectedToken: string = api.token;
            const firstSession: ConnectedWebSocket = await connectWebSocket(api.port, disconnectedToken);
            assert.deepStrictEqual(JSON.parse(await firstSession.firstMessage), { version: 1, type: "welcome" });
            await closeWebSocket(firstSession.socket);

            for (let attempt: number = 0; attempt < 20 && api.token === disconnectedToken; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            const renewedToken: string = api.token;
            assert.notStrictEqual(renewedToken, disconnectedToken);
            assert.strictEqual(await rejectUpgrade(api.port, `/${disconnectedToken}`), 401);

            const secondSession: ConnectedWebSocket = await connectWebSocket(api.port, renewedToken);
            try {
                assert.deepStrictEqual(JSON.parse(await secondSession.firstMessage), { version: 1, type: "welcome" });
            } finally {
                await closeWebSocket(secondSession.socket);
            }
        });
}
