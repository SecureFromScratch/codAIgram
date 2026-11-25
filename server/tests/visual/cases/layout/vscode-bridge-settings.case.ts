import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runVscodeBridgeSettingsScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "connects the project settings popup to the VS Code bridge and shows workspaces",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/19 09:35", text: "Clicking the project settings gear opens a popup. When the VS Code bridge is not connected it contains a bridge-link textbox. Entering the bridge-mock URL and clicking Connect connects and replaces the textbox with the available VS Code workspaces. Add helper methods isVscodeBridgeConnected(), isVscodeBridgeConfigured(), and workspacesLastFetchTimestamp() for tests." }
    ]
  }
};

export function registerVscodeBridgeSettingsCase(): void {
  test(TEST_CASE_METADATA.title, runVscodeBridgeSettingsScenario);
}
