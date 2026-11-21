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
  title: "allows one connection after failed auth and consumes the token permanently",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerConsumeTokenAfterFailedAuthCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            assert.strictEqual(await rejectUpgrade(api.port, "/incorrect-token"), 401);
            const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
            try {
                assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
                connection.socket.send("Ping");
                await Promise.resolve();
                assert.strictEqual(connection.socket.readyState, NodeWebSocket.OPEN);
                assert.strictEqual(await rejectUpgrade(api.port, `/${api.token}`), 401);
            } finally {
                await closeWebSocket(connection.socket);
            }
            assert.strictEqual(await rejectUpgrade(api.port, `/${api.token}`), 401);
        });
}
