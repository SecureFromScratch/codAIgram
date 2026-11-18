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
  title: "preserves HTTP behavior on the dynamically allocated port",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerDynamicPortHttpCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api = getApi();
            assert.notStrictEqual(api.port, fixedPort);
            assert.strictEqual((await request(api.port, "GET")).statusCode, 404);
            assert.strictEqual((await request(api.port, "POST")).statusCode, 405);
        });
}
