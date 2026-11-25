import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runWorkspaceRemoveSelectedFolderScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "drops a removed selected VS Code folder while preserving the remaining selection",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/21 09:35", text: "After selecting multiple folders, replace the mock bridge with a new folder list that removes one selected folder. Reopen settings, reconnect with the new link, and verify the removed folder is absent and only the still-available selected folder remains selected." }
    ]
  }
};

export function registerWorkspaceRemoveSelectedFolderCase(): void {
  test(TEST_CASE_METADATA.title, runWorkspaceRemoveSelectedFolderScenario);
}
