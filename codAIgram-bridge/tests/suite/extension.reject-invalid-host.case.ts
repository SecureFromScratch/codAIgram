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
  title: "rejects invalid Host headers without consuming the token",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerRejectInvalidHostCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            const token: string = api.token;
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, ""), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `localhost:${api.port + 1}`), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `attacker.example:${api.port}`), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1.evil.example:${api.port}`), 401);
            const connection: ConnectedWebSocket = await connectWebSocket(api.port, token);
            try {
                assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            } finally {
                await closeWebSocket(connection.socket);
            }
        });
}
