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
  title: "regenerates the token and invalidates the previous token",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerRegenerateTokenCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            const oldToken: string = api.token;
            const originalCreateInputBox: () => vscode.InputBox = vscode.window.createInputBox;
            let shownValue: string = "";
            const valueEvents: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
            const buttonEvents: vscode.EventEmitter<vscode.QuickInputButton> = new vscode.EventEmitter<vscode.QuickInputButton>();
            const hideEvents: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
            const inputBox: vscode.InputBox = {
              value: "",
              buttons: [],
              onDidChangeValue: valueEvents.event,
              onDidTriggerButton: buttonEvents.event,
              onDidHide: hideEvents.event,
              show: () => { shownValue = inputBox.value; },
              hide: () => hideEvents.fire(),
              dispose: () => {}
            } as unknown as vscode.InputBox;
            vscode.window.createInputBox = () => inputBox;

            try {
                await vscode.commands.executeCommand("codaigram-bridge.regenerateToken");
                await vscode.commands.executeCommand("codaigram-bridge.showConnectionUrl");
            } finally {
                vscode.window.createInputBox = originalCreateInputBox;
                hideEvents.fire();
                valueEvents.dispose();
                buttonEvents.dispose();
                hideEvents.dispose();
            }

            const newToken: string | undefined = shownValue.split("/").at(-1);
            assert.ok(newToken);
            assert.notStrictEqual(newToken, oldToken);
            assert.strictEqual(await rejectUpgrade(api.port, `/${oldToken}`), 401);
            assert.strictEqual(api.token, newToken);
        });
}
