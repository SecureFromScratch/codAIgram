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
  title: "provides a Copy button that copies the active pairing URL",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerCopyButtonCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api = getApi();
            const originalCreateInputBox = vscode.window.createInputBox;
            const valueEvents: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
            const buttonEvents: vscode.EventEmitter<vscode.QuickInputButton> = new vscode.EventEmitter<vscode.QuickInputButton>();
            const hideEvents: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
            const fakeInputBox = {
                value: "",
                buttons: [] as vscode.QuickInputButton[],
                onDidChangeValue: valueEvents.event,
                onDidTriggerButton: buttonEvents.event,
                onDidHide: hideEvents.event,
                show: () => {},
                hide: () => {},
                dispose: () => {}
            } as unknown as vscode.InputBox;
            let inputBox: vscode.InputBox | undefined;
            vscode.window.createInputBox = () => {
                inputBox = fakeInputBox;
                return inputBox;
            };

            try {
                await vscode.commands.executeCommand("codaigram-bridge.showConnectionUrl");
            } finally {
                vscode.window.createInputBox = originalCreateInputBox;
            }

            assert.ok(inputBox, "The pairing URL input should be created.");
            assert.ok(inputBox.buttons.some((button) => button.tooltip === "Copy Connection URL"), "The input should provide a Copy button.");
            buttonEvents.fire(inputBox.buttons[0]);
            const expectedUrl = `http://localhost:${api.port}/${api.token}`;
            for (let attempt = 0; attempt < 20 && await vscode.env.clipboard.readText() !== expectedUrl; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            assert.strictEqual(await vscode.env.clipboard.readText(), expectedUrl);
            valueEvents.dispose();
            buttonEvents.dispose();
            hideEvents.fire();
            hideEvents.dispose();
        });
}
