import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { resolveWorkspaceFolders } from "../../src/workspaceRoot";
import { resolveLaunchDirectory, resolveLaunchDirectoryFrom } from "../../src/launchDirectory";

type WorkspaceFoldersT = typeof vscode.workspace.workspaceFolders;

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "resolves an existing active workspace as the canonical launch directory",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Compose active workspace resolution and canonical working-directory validation." }]
  }
};

export function registerLaunchDirectoryCase(): void {
    test(TEST_CASE_METADATA.title, async () => {
        if (process.env.CODAIGRAM_BRIDGE_SCENARIO === "shutdown") {
            const folders: WorkspaceFoldersT = vscode.workspace.workspaceFolders;
            assert.ok(folders && folders.length === 1);
            assert.strictEqual((await resolveLaunchDirectory())._unsafeUnwrap(), await fs.realpath(folders[0].uri.fsPath));
        } else {
            assert.strictEqual((await resolveLaunchDirectory())._unsafeUnwrapErr(), "no_workspace");
        }
        const first: vscode.Uri = vscode.Uri.file(path.resolve(__dirname, "../../../missing-workspace-first"));
        const second: vscode.Uri = vscode.Uri.file(path.resolve(__dirname, "../../../missing-workspace-second"));
        assert.strictEqual((await resolveLaunchDirectoryFrom(resolveWorkspaceFolders([])))._unsafeUnwrapErr(), "no_workspace");
        assert.strictEqual((await resolveLaunchDirectoryFrom(resolveWorkspaceFolders([{ uri: first }, { uri: second }])))._unsafeUnwrapErr(), "ambiguous_workspace");
        assert.strictEqual((await resolveLaunchDirectoryFrom(resolveWorkspaceFolders([{ uri: vscode.Uri.parse("virtual://host/root") }])))._unsafeUnwrapErr(), "unsupported_workspace_uri");
        assert.strictEqual((await resolveLaunchDirectoryFrom(resolveWorkspaceFolders([{ uri: first }])))._unsafeUnwrapErr(), "invalid_workspace_root");
    });
}
