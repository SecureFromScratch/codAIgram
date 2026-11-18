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
  title: "requires an exact trusted Origin before consuming the token",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerTrustedOriginRequiredCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api = getApi();
            const token = api.token;
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1:${api.port}`), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1:${api.port}`, "null"), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1:${api.port}`, "not-an-origin"), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1:${api.port}`, "https://evil.example"), 401);
            const accepted = await connectWebSocket(api.port, token, trustedOrigin);
            try {
                assert.strictEqual(await accepted.firstMessage, "Hello");
            } finally {
                await closeWebSocket(accepted.socket);
            }
        });
}
