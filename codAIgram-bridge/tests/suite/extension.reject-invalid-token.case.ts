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
  title: "rejects missing and invalid tokens with 401",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerRejectInvalidTokenCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api = getApi();
            assert.strictEqual(await rejectUpgrade(api.port, "/"), 401);
            assert.strictEqual(await rejectUpgrade(api.port, "/incorrect-token"), 401);
        });
}
