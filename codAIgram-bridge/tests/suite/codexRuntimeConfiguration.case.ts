import * as assert from "node:assert";
import { normalizeCodexWorkspaceConfiguration } from "../../src/codexWorkspace";
import type { CodexWorkspaceConfiguration } from "../../src/codexWorkspace";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "includes cwd and additional folders in the Codex workspace configuration",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/23 09:35", text: "Update the prompt workspace test so workFolders contains only folders additional to cwd; the bridge must include cwd in Codex's final work-folder list." }]
  }
};

export function registerCodexRuntimeConfigurationCase(): void {
  test(TEST_CASE_METADATA.title, () => {
    const configuration: CodexWorkspaceConfiguration = normalizeCodexWorkspaceConfiguration("C:\\workspace", []);
    assert.strictEqual(configuration.cwd, "C:\\workspace");
    assert.deepStrictEqual(configuration.workFolders, ["C:\\workspace"]);
    const multiFolderConfiguration: CodexWorkspaceConfiguration = normalizeCodexWorkspaceConfiguration("C:\\workspace-main", ["C:\\workspace-additional"]);
    assert.strictEqual(multiFolderConfiguration.cwd, "C:\\workspace-main");
    assert.deepStrictEqual(multiFolderConfiguration.workFolders, ["C:\\workspace-main", "C:\\workspace-additional"]);
  });
}
