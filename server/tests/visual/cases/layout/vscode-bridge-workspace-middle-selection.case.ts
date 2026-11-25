import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runMiddleWorkspaceSelectionScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "persists the third and fourth selected VS Code workspaces when settings are reopened",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/21 09:35", text: "Repeat the five-folder workspace selection persistence test, keeping only the third and fourth folders selected and verifying that only those folders remain selected after closing and reopening settings without reconnecting." }
    ]
  }
};

export function registerVscodeBridgeWorkspaceMiddleSelectionCase(): void {
  test(TEST_CASE_METADATA.title, runMiddleWorkspaceSelectionScenario);
}
