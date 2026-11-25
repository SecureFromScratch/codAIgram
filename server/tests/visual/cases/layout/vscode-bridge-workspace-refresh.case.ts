import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runVscodeBridgeWorkspaceRefreshScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "reopening bridge settings fetches the workspace list after the bridge restarts",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/19 09:35", text: "Add a test: after connecting to the VS Code bridge, opening the settings button shows available workspaces. Close the popup, restart mock-bridge with a different config file and workspace folders, then reopen settings and verify the new workspace list appears." }
    ]
  }
};

export function registerVscodeBridgeWorkspaceRefreshCase(): void {
  test(TEST_CASE_METADATA.title, runVscodeBridgeWorkspaceRefreshScenario);
}
