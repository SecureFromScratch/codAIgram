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
  title: "allows exactly one simultaneous connection for the token",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerConcurrentTokenConnectionsCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            const first: Promise<ConnectedWebSocket> = connectWebSocket(api.port, api.token);
            const second: Promise<ConnectedWebSocket> = connectWebSocket(api.port, api.token);
            const results: [PromiseSettledResult<ConnectedWebSocket>, PromiseSettledResult<ConnectedWebSocket>] = await Promise.allSettled([first, second]);
            const successes: PromiseFulfilledResult<ConnectedWebSocket>[] = results.filter((result) => result.status === "fulfilled");
            const failures: PromiseRejectedResult[] = results.filter((result) => result.status === "rejected");
            assert.strictEqual(successes.length, 1);
            assert.strictEqual(failures.length, 1);
            assert.deepStrictEqual(JSON.parse(await successes[0].value.firstMessage), { version: 1, type: "welcome" });
            await closeWebSocket(successes[0].value.socket);
        });
}
