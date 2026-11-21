import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as vscode from "vscode";
import { resolveWorkspaceFolders, resolveWorkspaceRoot } from "../../src/workspaceRoot";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "resolves only a single local workspace folder",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Resolve the working directory for exactly one workspace folder; reject absent and ambiguous workspaces." }]
  }
};

export function registerWorkspaceRootCase(): void {
    test(TEST_CASE_METADATA.title, () => {
        const first: vscode.Uri = vscode.Uri.file("/workspace/first");
        const second: vscode.Uri = vscode.Uri.file("/workspace/second");
        if (process.env.CODAIGRAM_BRIDGE_SCENARIO === "shutdown") {
            assert.ok(resolveWorkspaceRoot().isOk());
        } else {
            assert.strictEqual(resolveWorkspaceRoot()._unsafeUnwrapErr(), "no_workspace");
        }
        assert.deepStrictEqual(resolveWorkspaceFolders([])._unsafeUnwrapErr(), "no_workspace");
        assert.strictEqual(resolveWorkspaceFolders([{ uri: first }])._unsafeUnwrap(), first.fsPath);
        assert.strictEqual(resolveWorkspaceFolders([{ uri: first }, { uri: second }])._unsafeUnwrapErr(), "ambiguous_workspace");
        assert.strictEqual(resolveWorkspaceFolders([{ uri: vscode.Uri.parse("vscode-remote://host/workspace") }])._unsafeUnwrapErr(), "unsupported_workspace_uri");
    });
}
