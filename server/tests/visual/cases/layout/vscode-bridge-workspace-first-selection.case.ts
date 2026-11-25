import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runFirstWorkspaceSelectionScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "persists only the first selected VS Code workspace when settings are reopened",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/21 09:35", text: "Expand the workspace selection persistence test to five folders, deselect four, close and reopen settings without reconnecting, and verify only the first folder remains selected." }
    ]
  }
};

export function registerVscodeBridgeWorkspaceFirstSelectionCase(): void {
  test(TEST_CASE_METADATA.title, runFirstWorkspaceSelectionScenario);
}
