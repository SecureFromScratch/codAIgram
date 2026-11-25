import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runVscodeBridgeWorkspaceReloadSelectionScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "restores the VS Code bridge connection and workspace selection without reconnecting after reload",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/21 09:35", text: "Change the page-reload workspace test to expect the bridge connection and selected folders to be restored without entering the bridge link or reconnecting." }
    ]
  }
};

export function registerVscodeBridgeWorkspaceReloadSelectionCase(): void {
  test(TEST_CASE_METADATA.title, runVscodeBridgeWorkspaceReloadSelectionScenario);
}
