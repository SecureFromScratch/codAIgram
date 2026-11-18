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
  title: "rejects invalid Host headers without consuming the token",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerRejectInvalidHostCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api = getApi();
            const token = api.token;
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, ""), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `localhost:${api.port + 1}`), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `attacker.example:${api.port}`), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1.evil.example:${api.port}`), 401);
            const connection = await connectWebSocket(api.port, token);
            try {
                assert.strictEqual(await connection.firstMessage, "Hello");
            } finally {
                await closeWebSocket(connection.socket);
            }
        });
}
