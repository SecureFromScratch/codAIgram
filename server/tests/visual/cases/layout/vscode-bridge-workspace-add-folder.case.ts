import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runWorkspaceAddFolderScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "preserves selected VS Code folders when a folder is added in the middle",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/21 09:35", text: "After selecting folders, replace the mock bridge with a new folder list containing one added in the middle. Reopen settings, reconnect with the new link, and verify only the previously selected folders remain selected." }
    ]
  }
};

export function registerWorkspaceAddFolderCase(): void {
  test(TEST_CASE_METADATA.title, runWorkspaceAddFolderScenario);
}
