import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { runVscodeBridgeWorkspaceAgentCycleScenario } from "./vscode-bridge-settings-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "cycles workspace selection from unselected to agent to folder",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/23 09:35", text: "After connecting to the bridge, unselected folders show an empty checkbox. A configured-agent folder becomes a robot on first click and a folder on second click; a folder without configured chat ability becomes a folder immediately." }
    ]
  }
};

export function registerVscodeBridgeWorkspaceAgentCycleCase(): void {
  test(TEST_CASE_METADATA.title, runVscodeBridgeWorkspaceAgentCycleScenario);
}
