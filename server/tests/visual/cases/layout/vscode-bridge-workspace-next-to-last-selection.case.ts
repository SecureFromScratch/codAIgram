import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runNextToLastWorkspaceSelectionScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "persists only the next-to-last selected VS Code workspace when settings are reopened",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/21 09:35", text: "Repeat the five-folder workspace selection persistence test, keeping only the next-to-last folder selected and verifying that only it remains selected after closing and reopening settings without reconnecting." }
    ]
  }
};

export function registerVscodeBridgeWorkspaceNextToLastSelectionCase(): void {
  test(TEST_CASE_METADATA.title, runNextToLastWorkspaceSelectionScenario);
}
