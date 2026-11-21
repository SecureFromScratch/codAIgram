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
  title: "generates a fresh 256-bit base64url token",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerTokenGenerationCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            assert.match(api.token, /^[A-Za-z0-9_-]+$/);
            assert.strictEqual(Buffer.from(api.token, "base64url").byteLength, 32);
            assert.notStrictEqual(api.token, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        });
}
