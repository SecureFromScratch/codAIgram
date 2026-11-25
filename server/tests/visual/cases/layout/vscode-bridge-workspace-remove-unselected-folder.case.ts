import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runWorkspaceRemoveUnselectedFolderScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "preserves selected VS Code folders when an unselected middle folder is removed",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/21 09:35", text: "After selecting folders, replace the mock bridge with a new folder list that removes an unselected folder from the middle. Reopen settings, reconnect with the new link, and verify only the previously selected folders remain selected." }
    ]
  }
};

export function registerWorkspaceRemoveUnselectedFolderCase(): void {
  test(TEST_CASE_METADATA.title, runWorkspaceRemoveUnselectedFolderScenario);
}
