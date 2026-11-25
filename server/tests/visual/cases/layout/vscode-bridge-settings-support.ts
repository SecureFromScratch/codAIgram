import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Locator } from "playwright";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

type BridgeTestHookT = {
  isVscodeBridgeConnected: () => boolean;
  isVscodeBridgeConfigured: () => boolean;
  workspacesLastFetchTimestamp: () => number;
};

type BridgeTestStateT = {
  connection: "connected" | "disconnected";
  configuration: "configured" | "unconfigured";
  lastFetch: number;
};
type WorkspaceSelectionT = "selected" | "not-selected";
type WorkspaceSelectionStateT = {
  readonly name: string;
  readonly selection: WorkspaceSelectionT;
};

type WindowWithBridgeHookT = Window & { __app: BridgeTestHookT };
type RunningMockT = {
  process: ChildProcessWithoutNullStreams;
  connectionUrl: string;
  configPath: string;
  port: number;
};

const MOCK_TOKEN: string = "visual-test-token";
const UPDATED_MOCK_TOKEN: string = "updated-visual-test-token";
const WORKSPACE_TIMESTAMP: number = 1_900_000_000_000;
const WORKSPACE_NAMES: readonly [string, string, string, string, string] = [
  "CodAIgram",
  "Shared TypeScript Libraries",
  "BuildGates_ts",
  "vv_ts",
  "TypeScript Samples",
];
const TRUSTED_TEST_ORIGIN: string = "http://127.0.0.1:41731";
const UPDATED_WORKSPACE_NAMES: readonly [string, string] = ["Updated CodAIgram", "New Shared Workspace"];

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "connects the project settings popup to the VS Code bridge and shows workspaces",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/19 09:35", text: "Clicking the project settings gear opens a popup. When the VS Code bridge is not connected it contains a bridge-link textbox. Entering the bridge-mock URL and clicking Connect connects and replaces the textbox with the available VS Code workspaces. Add helper methods isVscodeBridgeConnected(), isVscodeBridgeConfigured(), and workspacesLastFetchTimestamp() for tests." }],
  },
};

export const WORKSPACE_REFRESH_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "reopening bridge settings fetches the workspace list after the bridge restarts",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/19 09:35", 
      text: "Add a test: after connecting to the VS Code bridge, opening the settings button shows available workspaces. Close the popup, restart mock-bridge with a different config file and workspace folders, then reopen settings and verify the new workspace list appears." 
    }],
  },
};

export const WORKSPACE_SELECTION_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "persists only the first selected VS Code workspace when settings are reopened",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/21 09:35", 
      text: "Expand the workspace selection persistence test to five folders, deselect four, close and reopen settings without reconnecting, and verify only the first folder remains selected." 
    }],
  },
};

export const WORKSPACE_SELECTION_LAST_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "persists only the last selected VS Code workspace when settings are reopened",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/21 09:35", 
      text: "Repeat the five-folder workspace selection persistence test, keeping only the last folder selected and verifying that only it remains selected after closing and reopening settings without reconnecting." 
    }],
  },
};

export const WORKSPACE_SELECTION_NEXT_TO_LAST_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "persists only the next-to-last selected VS Code workspace when settings are reopened",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/21 09:35", 
      text: "Repeat the five-folder workspace selection persistence test, keeping only the next-to-last folder selected and verifying that only it remains selected after closing and reopening settings without reconnecting." 
    }],
  },
};

export const WORKSPACE_SELECTION_THIRD_AND_FOURTH_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "persists the third and fourth selected VS Code workspaces when settings are reopened",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/21 09:35", 
      text: "Repeat the five-folder workspace selection persistence test, keeping only the third and fourth folders selected and verifying that only those folders remain selected after closing and reopening settings without reconnecting." 
    }],
  },
};

export const WORKSPACE_SELECTION_ADD_FOLDER_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "preserves selected VS Code folders when a folder is added in the middle",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/21 09:35", 
      text: "After selecting folders, replace the mock bridge with a new folder list containing one added in the middle. Reopen settings, reconnect with the new link, and verify only the previously selected folders remain selected." 
    }],
  },
};

export const WORKSPACE_SELECTION_REMOVE_UNSELECTED_FOLDER_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "preserves selected VS Code folders when an unselected middle folder is removed",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/21 09:35", 
      text: "After selecting folders, replace the mock bridge with a new folder list that removes an unselected folder from the middle. Reopen settings, reconnect with the new link, and verify only the previously selected folders remain selected." 
    }],
  },
};

export const WORKSPACE_SELECTION_REMOVE_SELECTED_FOLDER_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "drops a removed selected VS Code folder while preserving the remaining selection",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/21 09:35", 
      text: "After selecting multiple folders, replace the mock bridge with a new folder list that removes one selected folder. Reopen settings, reconnect with the new link, and verify the removed folder is absent and only the still-available selected folder remains selected." 
    }],
  },
};

export const WORKSPACE_SELECTION_RELOAD_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "restores the VS Code bridge connection and workspace selection without reconnecting after reload",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/21 09:35", 
      text: "Change the page-reload workspace test to expect the bridge connection and selected folders to be restored without entering the bridge link or reconnecting." 
    }],
  },
};

export const WORKSPACE_SELECTION_AGENT_CYCLE_TEST_CASE_METADATA: TestCaseMetadata = {
  title: "cycles workspace selection from unselected to agent to folder",
  prompt: {
    availability: "available",
    history: [{ 
      when: "2026/11/23 09:35", 
      text: "After connecting to the bridge, unselected folders show an empty checkbox. A configured-agent folder becomes a robot on first click and a folder on second click; a folder without configured chat ability becomes a folder immediately." 
    }],
  },
};

export async function runVscodeBridgeSettingsScenario(): Promise<void> {
    const mock: RunningMockT = await startMockBridge();
    try {
      await page.reload();
      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      const settings: Locator = page.getByRole("button", { name: "Project settings" });
      await selector.waitFor();
      await selector.hover();
      await settings.click();

      const dialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      const bridgeLink: Locator = dialog.getByRole("textbox", { name: "VS Code bridge link" });
      await bridgeLink.waitFor({ state: "visible" });
      const disconnectedState: BridgeTestStateT = {
        connection: "disconnected",
        configuration: "unconfigured",
        lastFetch: 0,
      };
      assert.deepEqual(await readBridgeHelpers(), disconnectedState);

      await bridgeLink.fill(mock.connectionUrl);
      await dialog.getByRole("button", { name: "Connect" }).click();
      await Promise.all(WORKSPACE_NAMES.map((name: string) => dialog.getByText(name, { exact: true }).waitFor({ state: "visible" })));
      assert.equal(await bridgeLink.count(), 0);
      assert.deepEqual(await dialog.getByRole("list").locator("li strong").allTextContents(), [...WORKSPACE_NAMES]);

      const connectedState: BridgeTestStateT = await readBridgeHelpers();
      assert.equal(connectedState.connection, "connected");
      assert.equal(connectedState.configuration, "configured");
      assert.ok(connectedState.lastFetch > disconnectedState.lastFetch);
      assert.ok(connectedState.lastFetch <= Date.now());

      await dialog.getByRole("button", { name: "Close VS Code bridge settings" }).click();
      await selector.hover();
      await settings.click();
      const reopenedDialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      assert.equal(await reopenedDialog.getByRole("textbox", { name: "VS Code bridge link" }).count(), 0);
      assert.deepEqual(await reopenedDialog.getByRole("list").locator("li strong").allTextContents(), [...WORKSPACE_NAMES]);
    } finally {
      await page.reload();
      await stopMockBridge(mock.process);
      unlinkSync(mock.configPath);
    }
}

export async function runVscodeBridgeWorkspaceRefreshScenario(): Promise<void> {
    const firstMock: RunningMockT = await startMockBridge(WORKSPACE_NAMES);
    let replacementMock: RunningMockT | undefined;
    try {
      await page.reload();
      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      const settings: Locator = page.getByRole("button", { name: "Project settings" });
      await selector.waitFor();
      await selector.hover();
      await settings.click();
      const dialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      await dialog.getByRole("textbox", { name: "VS Code bridge link" }).fill(firstMock.connectionUrl);
      await dialog.getByRole("button", { name: "Connect" }).click();
      await dialog.getByText(WORKSPACE_NAMES[0], { exact: true }).waitFor({ state: "visible" });
      const originalFetch: number = (await readBridgeHelpers()).lastFetch;

      await dialog.getByRole("button", { name: "Close VS Code bridge settings" }).click();
      await stopMockBridge(firstMock.process);
      replacementMock = await startMockBridge(UPDATED_WORKSPACE_NAMES, firstMock.port, UPDATED_MOCK_TOKEN);

      await selector.hover();
      await settings.click();
      const reopenedDialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      const replacementLink: Locator = reopenedDialog.getByRole("textbox", { name: "VS Code bridge link" });
      await replacementLink.waitFor({ state: "visible", timeout: 10_000 });
      await replacementLink.fill(replacementMock.connectionUrl);
      await reopenedDialog.getByRole("button", { name: "Connect" }).click();
      await reopenedDialog.getByText(UPDATED_WORKSPACE_NAMES[0], { exact: true }).waitFor({ state: "visible", timeout: 10_000 });
      assert.deepEqual(await reopenedDialog.getByRole("list").locator("li strong").allTextContents(), [...UPDATED_WORKSPACE_NAMES]);
      const refreshedState: BridgeTestStateT = await readBridgeHelpers();
      assert.equal(refreshedState.connection, "connected");
      assert.ok(refreshedState.lastFetch > originalFetch);
    } finally {
      await page.reload();
      await stopMockBridge(firstMock.process);
      unlinkSync(firstMock.configPath);
      if (replacementMock) {
        await stopMockBridge(replacementMock.process);
        unlinkSync(replacementMock.configPath);
      }
    }
}

export async function runFirstWorkspaceSelectionScenario(): Promise<void> {
  await runWorkspaceSelectionPersistenceScenario([WORKSPACE_NAMES[0]]);
}

export async function runLastWorkspaceSelectionScenario(): Promise<void> {
  await runWorkspaceSelectionPersistenceScenario([WORKSPACE_NAMES[4]]);
}

export async function runNextToLastWorkspaceSelectionScenario(): Promise<void> {
  await runWorkspaceSelectionPersistenceScenario([WORKSPACE_NAMES[3]]);
}

export async function runMiddleWorkspaceSelectionScenario(): Promise<void> {
  await runWorkspaceSelectionPersistenceScenario([WORKSPACE_NAMES[2], WORKSPACE_NAMES[3]]);
}

export async function runVscodeBridgeWorkspaceAgentCycleScenario(): Promise<void> {
    const mock: RunningMockT = await startMockBridge(WORKSPACE_NAMES);
    try {
      await page.evaluate(() => window.localStorage.removeItem("codaigram.vscodeBridgeWorkspaceUris"));
      await page.reload();
      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      await selector.waitFor();
      await selector.hover();
      await page.getByRole("button", { name: "Project settings" }).click();
      const dialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      await dialog.getByRole("textbox", { name: "VS Code bridge link" }).fill(mock.connectionUrl);
      await dialog.getByRole("button", { name: "Connect" }).click();
      await Promise.all(WORKSPACE_NAMES.map((name: string) => dialog.getByText(name, { exact: true }).waitFor({ state: "visible" })));
      const codexIcon: Locator = dialog.locator(".vscode-workspace-list li").nth(0).locator(".workspace-selection-icon");
      const plainIcon: Locator = dialog.locator(".vscode-workspace-list li").nth(2).locator(".workspace-selection-icon");
      assert.equal(await codexIcon.innerText(), "☐");
      assert.equal(await plainIcon.innerText(), "☐");
      await dialog.getByRole("button", { 
        name: `Cycle selection for ${WORKSPACE_NAMES[0]}` 
      }).click();
      assert.equal(await codexIcon.innerText(), "🤖");
      await dialog.getByRole("button", { 
        name: `Cycle selection for ${WORKSPACE_NAMES[0]}` 
      }).click();
      assert.equal(await codexIcon.innerText(), "📁");
      await dialog.getByRole("button", { 
        name: `Cycle selection for ${WORKSPACE_NAMES[2]}` 
      }).click();
      assert.equal(await plainIcon.innerText(), "📁");
    } finally {
      await page.evaluate(() => window.localStorage.removeItem("codaigram.vscodeBridgeWorkspaceUris"));
      await page.reload();
      await stopMockBridge(mock.process);
      unlinkSync(mock.configPath);
    }
}

export async function runWorkspaceAddFolderScenario(): Promise<void> {
  await runWorkspaceFolderRefreshScenario(
    WORKSPACE_NAMES,
    ["CodAIgram", "Shared TypeScript Libraries", "Added Workspace", "BuildGates_ts", "vv_ts", "TypeScript Samples"],
    ["Shared TypeScript Libraries", "vv_ts"],
    ["Shared TypeScript Libraries", "vv_ts"],
  );
}

export async function runWorkspaceRemoveUnselectedFolderScenario(): Promise<void> {
  await runWorkspaceFolderRefreshScenario(
    WORKSPACE_NAMES,
    ["CodAIgram", "Shared TypeScript Libraries", "vv_ts", "TypeScript Samples"],
    ["Shared TypeScript Libraries", "vv_ts"],
    ["Shared TypeScript Libraries", "vv_ts"],
  );
}

export async function runWorkspaceRemoveSelectedFolderScenario(): Promise<void> {
  await runWorkspaceFolderRefreshScenario(
    WORKSPACE_NAMES,
    ["CodAIgram", "BuildGates_ts", "vv_ts", "TypeScript Samples"],
    ["Shared TypeScript Libraries", "vv_ts"],
    ["vv_ts"],
  );
}

async function runWorkspaceFolderRefreshScenario(
  initialFolders: readonly string[],
  replacementFolders: readonly string[],
  initiallySelected: readonly string[],
  expectedSelected: readonly string[],
): Promise<void> {
    const initialMock: RunningMockT = await startMockBridge(initialFolders);
    let replacementMock: RunningMockT | undefined;
    try {
      await page.reload();
      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      const settings: Locator = page.getByRole("button", { name: "Project settings" });
      await selector.waitFor();
      await selector.hover();
      await settings.click();
      const dialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      await dialog.getByRole("textbox", { name: "VS Code bridge link" }).fill(initialMock.connectionUrl);
      await dialog.getByRole("button", { name: "Connect" }).click();
      await Promise.all(initialFolders.map((name: string) => dialog.getByRole("checkbox", { name }).waitFor({ state: "visible" })));
      await setSelectedWorkspaceNames(dialog, initialFolders, initiallySelected);
      assert.deepEqual(await getSelectedWorkspaceNames(dialog), [...initiallySelected]);

      await dialog.getByRole("button", { name: "Close VS Code bridge settings" }).click();
      await stopMockBridge(initialMock.process);
      replacementMock = await startMockBridge(replacementFolders);
      assert.notEqual(replacementMock.connectionUrl, initialMock.connectionUrl);

      await selector.hover();
      await settings.click();
      const refreshedDialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      const replacementLink: Locator = refreshedDialog.getByRole("textbox", { name: "VS Code bridge link" });
      await replacementLink.waitFor({ state: "visible", timeout: 10_000 });
      await replacementLink.fill(replacementMock.connectionUrl);
      await refreshedDialog.getByRole("button", { name: "Connect" }).click();
      await Promise.all(replacementFolders.map((name: string) => refreshedDialog.getByRole("checkbox", { name }).waitFor({ state: "visible" })));
      assert.deepEqual(await refreshedDialog.getByRole("list").locator("li strong").allTextContents(), [...replacementFolders]);
      assert.deepEqual(await getSelectedWorkspaceNames(refreshedDialog, replacementFolders), [...expectedSelected]);
    } finally {
      await page.reload();
      await stopMockBridge(initialMock.process);
      unlinkSync(initialMock.configPath);
      if (replacementMock) {
        await stopMockBridge(replacementMock.process);
        unlinkSync(replacementMock.configPath);
      }
    }
}

async function setSelectedWorkspaceNames(dialog: Locator, allNames: readonly string[], selectedNames: readonly string[]): Promise<void> {
  const selectPromise: Promise<void> = allNames.reduce<Promise<void>>(async (previous: Promise<void>, name: string) => {
    await previous;
    const checkbox: Locator = dialog.getByRole("checkbox", { name });
    if (selectedNames.includes(name) && !await checkbox.isChecked()) await checkbox.check();
  }, Promise.resolve());
  await selectPromise;
  const deselectPromise: Promise<void> = allNames.reduce<Promise<void>>(async (previous: Promise<void>, name: string) => {
    await previous;
    const checkbox: Locator = dialog.getByRole("checkbox", { name });
    if (!selectedNames.includes(name) && await checkbox.isChecked()) await checkbox.uncheck();
  }, Promise.resolve());
  await deselectPromise;
}

async function runWorkspaceSelectionPersistenceScenario(selectedNames: readonly string[]): Promise<void> {
    const mock: RunningMockT = await startMockBridge(WORKSPACE_NAMES);
    try {
      await page.reload();
      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      const settings: Locator = page.getByRole("button", { name: "Project settings" });
      await selector.waitFor();
      await selector.hover();
      await settings.click();
      const dialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      await dialog.getByRole("textbox", { name: "VS Code bridge link" }).fill(mock.connectionUrl);
      await dialog.getByRole("button", { name: "Connect" }).click();

      await Promise.all(WORKSPACE_NAMES.map((name: string) => dialog.getByRole("checkbox", { name }).waitFor({ state: "visible" })));
      await setSelectedWorkspaceNames(dialog, WORKSPACE_NAMES, selectedNames);
      assert.deepEqual(await getSelectedWorkspaceNames(dialog), [...selectedNames]);

      await dialog.getByRole("button", { name: "Close VS Code bridge settings" }).click();
      await selector.hover();
      await settings.click();
      const reopenedDialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      await Promise.all(WORKSPACE_NAMES.map((name: string) => reopenedDialog.getByRole("checkbox", { name }).waitFor({ state: "visible" })));
      assert.deepEqual(await reopenedDialog.getByRole("list").locator("li strong").allTextContents(), [...WORKSPACE_NAMES]);
      assert.deepEqual(await getSelectedWorkspaceNames(reopenedDialog), [...selectedNames]);
    } finally {
      await page.reload();
      await stopMockBridge(mock.process);
      unlinkSync(mock.configPath);
    }
}

export async function runVscodeBridgeWorkspaceReloadSelectionScenario(): Promise<void> {
    const mock: RunningMockT = await startMockBridge(WORKSPACE_NAMES);
    try {
      await page.evaluate(() => {
        window.localStorage.removeItem("codaigram.vscodeBridgeWorkspaceUris");
        window.localStorage.removeItem("codaigram.vscodeBridgeSession");
      });
      await page.reload();
      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      const settings: Locator = page.getByRole("button", { name: "Project settings" });
      await selector.waitFor();
      await selector.hover();
      await settings.click();
      const dialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      await dialog.getByRole("textbox", { name: "VS Code bridge link" }).fill(mock.connectionUrl);
      await dialog.getByRole("button", { name: "Connect" }).click();

      await Promise.all(WORKSPACE_NAMES.map((name: string) => dialog.getByRole("checkbox", { name }).waitFor({ state: "visible" })));
      await setSelectedWorkspaceNames(dialog, WORKSPACE_NAMES, [WORKSPACE_NAMES[0]]);
      assert.deepEqual(await getSelectedWorkspaceNames(dialog), [WORKSPACE_NAMES[0]]);
      await dialog.getByRole("button", { name: "Close VS Code bridge settings" }).click();

      await page.reload();
      await selector.waitFor();
      await selector.hover();
      await settings.click();
      const reloadedDialog: Locator = page.getByRole("dialog", { name: "VS Code workspaces" });
      await reloadedDialog.locator(".vscode-workspace-list").waitFor({ state: "visible", timeout: 10_000 });
      const reloadedState: BridgeTestStateT = await readBridgeHelpers();
      assert.equal(reloadedState.connection, "connected", "the bridge should reconnect automatically after the page reload");
      assert.equal(reloadedState.configuration, "configured");
      assert.equal(await reloadedDialog.getByRole("textbox", { name: "VS Code bridge link" }).count(), 0);
      await Promise.all(WORKSPACE_NAMES.map((name: string) => reloadedDialog.getByRole("checkbox", { name }).waitFor({ state: "visible" })));
      assert.deepEqual(await getSelectedWorkspaceNames(reloadedDialog), [WORKSPACE_NAMES[0]]);
    } finally {
      await page.evaluate(() => {
        window.localStorage.removeItem("codaigram.vscodeBridgeWorkspaceUris");
        window.localStorage.removeItem("codaigram.vscodeBridgeSession");
      });
      await page.reload();
      await stopMockBridge(mock.process);
      unlinkSync(mock.configPath);
    }
}

async function getSelectedWorkspaceNames(dialog: Locator, availableNames: readonly string[] = WORKSPACE_NAMES): Promise<string[]> {
  const readSelectionState: (name: string) => Promise<WorkspaceSelectionStateT> = async (name: string) => {
    const checkbox: Locator = dialog.getByRole("checkbox", { name });
    const selection: WorkspaceSelectionT = await checkbox.isChecked() ? "selected" : "not-selected";
    return { name, selection };
  };
  const selectionStates: WorkspaceSelectionStateT[] = await Promise.all(availableNames.map(readSelectionState));
  return selectionStates.filter((state: WorkspaceSelectionStateT) => state.selection === "selected").map((state: WorkspaceSelectionStateT) => state.name);
}

async function readBridgeHelpers(): Promise<BridgeTestStateT> {
  return page.evaluate(() => {
    const hook: BridgeTestHookT = (window as unknown as WindowWithBridgeHookT).__app;
    return {
      connection: hook.isVscodeBridgeConnected() ? "connected" : "disconnected",
      configuration: hook.isVscodeBridgeConfigured() ? "configured" : "unconfigured",
      lastFetch: hook.workspacesLastFetchTimestamp(),
    };
  });
}

async function startMockBridge(workspaceNames: readonly string[] = WORKSPACE_NAMES, port: number = 0, token: string = MOCK_TOKEN): Promise<RunningMockT> {
  const configPath: string = join(tmpdir(), `codaigram-bridge-mock-${process.pid}-${Date.now()}.json`);
  writeFileSync(configPath, JSON.stringify({
    authtoken: token,
    port,
    workspaceFolders: workspaceNames.map((name: string, index: number) => ({
      name,
      uri: `file:///workspace/${name.replaceAll(" ", "-").toLowerCase()}`,
      index,
      configuredAgents: name === WORKSPACE_NAMES[0] ? ["codex"] : name === WORKSPACE_NAMES[1] ? ["claude"] : [],
    })),
    workspaceLastModified: WORKSPACE_TIMESTAMP,
    promptResponses: [],
    trustedOrigins: [TRUSTED_TEST_ORIGIN],
  }), "utf8");
  const mockProcess: ChildProcessWithoutNullStreams = spawn(process.execPath, [resolve("bridge-mock/dist/main.js"), configPath], { cwd: process.cwd(), stdio: "pipe" });
  let standardError: string = "";
  const allocatedPort: number = await new Promise<number>((resolvePort, rejectPort) => {
    let standardOutput: string = "";
    let settled: boolean = false;
    const startupTimeout: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (settled) return;
      settled = true;
      mockProcess.kill();
      rejectPort(new Error("Timed out waiting for bridge-mock to start."));
    }, 10_000);
    mockProcess.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      standardOutput += chunk.toString();
      // UNTRUST-ALLOW-NULLISH: RegExp.exec returns null when bridge-mock has not printed its ready line yet; the guard keeps startup pending until a usable listener port is available.
      const match: RegExpExecArray | null = /listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(standardOutput);
      if (!match || !match[1]) return;
      settled = true;
      clearTimeout(startupTimeout);
      resolvePort(Number(match[1]));
    });
    mockProcess.stderr.on("data", (chunk: Buffer) => { standardError += chunk.toString(); });
    mockProcess.once("error", (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimeout);
      rejectPort(error);
    });
    mockProcess.once("exit", () => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimeout);
      rejectPort(new Error(standardError || "bridge-mock exited before it started."));
    });
  });
  return {
    process: mockProcess,
    connectionUrl: `http://127.0.0.1:${allocatedPort}/${token}`,
    configPath,
    port: allocatedPort,
  };
}

async function stopMockBridge(mockProcess: ChildProcessWithoutNullStreams): Promise<void> {
  // UNTRUST-ALLOW-NULLISH: Node represents a still-running child process with null exit and signal codes; both null checks prevent killing or awaiting a process that has already exited.
  if (mockProcess.exitCode !== null || mockProcess.signalCode !== null) return;
  mockProcess.kill();
  await new Promise<void>((resolveStop) => mockProcess.once("exit", () => resolveStop()));
}
