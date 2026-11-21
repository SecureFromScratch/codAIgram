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
type ExecuteCommandT = typeof vscode.commands.executeCommand;

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "provides a Copy button that copies the active pairing URL",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerCopyButtonCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
            const api: BridgeApi = getApi();
            const originalCreateInputBox: () => vscode.InputBox = vscode.window.createInputBox;
            const originalExecuteCommand: ExecuteCommandT = vscode.commands.executeCommand;
            const valueEvents: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
            const buttonEvents: vscode.EventEmitter<vscode.QuickInputButton> = new vscode.EventEmitter<vscode.QuickInputButton>();
            const hideEvents: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
            const fakeInputBox: vscode.InputBox = {
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
            let copyCommandInvoked: boolean = false;
            vscode.window.createInputBox = () => {
                inputBox = fakeInputBox;
                return inputBox;
            };
            const interceptExecuteCommand: ExecuteCommandT = async <T = unknown>(command: string, ..._rest: readonly unknown[]) => {
                if (command === "codaigram-bridge.copyConnectionUrl") copyCommandInvoked = true;
                // UNTRUST-ALLOW-NULLISH: The test interception intentionally returns a null command result because only command invocation is under test and no value is consumed.
                return null as T;
            };
            try {
                await vscode.commands.executeCommand("codaigram-bridge.showConnectionUrl");
            } finally {
                vscode.window.createInputBox = originalCreateInputBox;
            }

            assert.ok(inputBox, "The pairing URL input should be created.");
            assert.ok(inputBox.buttons.some((button) => button.tooltip === "Copy Connection URL"), "The input should provide a Copy button.");
            vscode.commands.executeCommand = interceptExecuteCommand;
            buttonEvents.fire(inputBox.buttons[0]);
            assert.strictEqual(copyCommandInvoked, true);
            vscode.commands.executeCommand = originalExecuteCommand;
            valueEvents.dispose();
            buttonEvents.dispose();
            hideEvents.fire();
            hideEvents.dispose();
        });
}
