import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import type { BridgeApi } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "starts an isolated VS Code bridge host on the mock test project",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/22 09:35", text: "Run the live chat visual test with a newly started isolated VS Code instance and scanner/mock-testproject. Get the dynamic bridge pairing URL from the bridge extension activation API and publish it to the browser test; do not depend on an environment-supplied URL or the user's running VS Code." }
    ]
  }
};

export function registerLiveVisualHostCase(): void {
    test(TEST_CASE_METADATA.title, async function (this: Mocha.Context): Promise<void> {
        this.timeout(180_000);
        const readyFilePath: string | undefined = process.env.CODAIGRAM_LIVE_HOST_READY_FILE;
        const stopFilePath: string | undefined = process.env.CODAIGRAM_LIVE_HOST_STOP_FILE;
        const expectedProjectPath: string | undefined = process.env.CODAIGRAM_LIVE_PROJECT_PATH;
        assert.ok(readyFilePath && stopFilePath && expectedProjectPath);
        const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
        assert.ok(folders && folders.length === 1);
        assert.equal(folders[0].name, "mock-testproject");
        const actualWorkspacePath: string = path.resolve(folders[0].uri.fsPath);
        const resolvedExpectedPath: string = path.resolve(expectedProjectPath);
        const comparableActualPath: string = process.platform === "win32" ? actualWorkspacePath.toLocaleLowerCase() : actualWorkspacePath;
        const comparableExpectedPath: string = process.platform === "win32" ? resolvedExpectedPath.toLocaleLowerCase() : resolvedExpectedPath;
        assert.equal(comparableActualPath, comparableExpectedPath);

        const installedExtension: vscode.Extension<BridgeApi> | undefined = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
        assert.ok(installedExtension, "The isolated Extension Development Host must load CodAIgram Bridge.");
        const api: BridgeApi = await installedExtension.activate();
        assert.ok(Number.isInteger(api.port) && api.port > 0);
        assert.ok(api.token.length > 0);
        const bridgeConnectionRecord: { readonly connectionUrl: string } = {
          connectionUrl: `ws://localhost:${String(api.port)}/${api.token}`
        };
        const temporaryReadyFilePath: string = `${readyFilePath}.tmp`;
        await fs.writeFile(temporaryReadyFilePath, JSON.stringify(bridgeConnectionRecord), "utf8");
        await fs.rename(temporaryReadyFilePath, readyFilePath);

        const deadline: number = Date.now() + 180_000;
        while (Date.now() < deadline) {
            if (existsSync(stopFilePath)) return;
            await new Promise<void>((resolve) => setTimeout(resolve, 100));
        }
        // UNTRUST-ALLOW-UNLOGGED-THROW: Mocha reports this fixed timeout failure and its stack to the extension-test runner; no prompt or credential is included.
        throw new Error("The browser visual test did not finish before the isolated VS Code host timed out.");
    });
}

suite(TEST_CASE_METADATA.title, () => registerLiveVisualHostCase());
