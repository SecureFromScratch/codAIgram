import type { Locator } from 'playwright';
import { removeMockBridgeConfig, startMockBridgeWithFolders, stopMockBridge, type MockWorkspaceT, type RunningMockBridgeT } from './support/mock-bridge.js';
import { page } from './test-support.js';

export type ProjectFolderT = {
  readonly name: string;
  readonly uri: string;
  readonly index: number;
};

export const SAMPLE_PROJECT_FOLDER: ProjectFolderT = {
  name: 'codAIgram',
  uri: 'file:///c%3A/Users/yariv/Source/Effective/codAIgram/codAIgram',
  index: 0,
};

export const MANY_PROJECT_FOLDERS: readonly ProjectFolderT[] = Array.from({ length: 15 }, (_unused: undefined, index: number) => {
  const name: string = `Workspace ${String(index + 1).padStart(2, '0')}`;
  const encodedName: string = encodeURIComponent(name);
  return {
    name,
    uri: `file:///c%3A/Users/yariv/Source/Effective/${encodedName}/${encodedName}`,
    index,
  };
});

type ProjectFolderTestHookT = {
  readonly connectToVscodeBridge: (connectionLink: string) => Promise<void>;
  readonly getVscodeWorkspaces: () => readonly ProjectFolderT[];
};

type WindowWithProjectFolderHookT = Window & { readonly __app: ProjectFolderTestHookT };
type ProjectFolderScrollOptionsT = {
  readonly direction: 'up' | 'down';
  readonly amount: number;
};
export type ConnectedWorkspacePopupT = {
  readonly mock: RunningMockBridgeT;
  readonly dialog: Locator;
};

export async function openProjectFoldersPopup(): Promise<Locator> {
  const selector: Locator = page.getByRole('combobox', { name: 'Current project' });
  await selector.waitFor({ state: 'visible' });
  await selector.hover();
  await page.getByRole('button', { name: 'Project settings' }).click();
  return page.getByRole('dialog', { name: 'VS Code workspaces' });
}

export async function connectToMockBridge(connectionLink: string): Promise<void> {
  await page.evaluate(async (link: string) => {
    const hook: ProjectFolderTestHookT = (window as unknown as WindowWithProjectFolderHookT).__app;
    await hook.connectToVscodeBridge(link);
  }, connectionLink);
}

export async function getProjectFolders(): Promise<readonly ProjectFolderT[]> {
  return page.evaluate(() => {
    const hook: ProjectFolderTestHookT = (window as unknown as WindowWithProjectFolderHookT).__app;
    return hook.getVscodeWorkspaces();
  });
}

export async function scrollProjectFolderScrollbar(direction: 'up' | 'down', amount: number): Promise<number> {
  const list: Locator = page.locator('.vscode-workspace-list');
  const options: ProjectFolderScrollOptionsT = { direction, amount };
  return list.evaluate((element: HTMLElement, scrollOptions: ProjectFolderScrollOptionsT) => {
    const delta: number = scrollOptions.direction === 'down' ? scrollOptions.amount : -scrollOptions.amount;
    element.scrollTop += delta;
    return element.scrollTop;
  }, options);
}

export async function connectAndOpenProjectFolders(folders: readonly MockWorkspaceT[]): Promise<ConnectedWorkspacePopupT> {
  const mock: RunningMockBridgeT = await startMockBridgeWithFolders(folders);
  try {
    const firstFolder: MockWorkspaceT | undefined = folders.at(0);
    if (!firstFolder) {
      // UNTRUST-ALLOW-UNLOGGED-THROW: This is a test fixture programming error detected before starting the browser connection; the fixed message identifies the empty input and contains no sensitive runtime data.
      throw new Error('At least one mock workspace folder is required.');
    }
    await page.reload();
    const dialog: Locator = await openProjectFoldersPopup();
    await connectToMockBridge(mock.connectionUrl);
    await dialog.locator('.vscode-workspace-list').waitFor({ state: 'visible' });
    await dialog.getByText(firstFolder.name, { exact: true }).waitFor({ state: 'visible' });
    return { mock, dialog };
  } catch (error: unknown) {
    console.error('Could not prepare the mock VS Code workspace popup for a visual test.', error);
    await stopMockBridge(mock.process);
    await removeMockBridgeConfig(mock.configPath);
    // UNTRUST-ALLOW-UNLOGGED-THROW: The caught setup failure was logged above; rethrow it unchanged after releasing the mock process and its temporary configuration.
    throw error;
  }
}

export async function closeProjectFoldersPopup(mock: RunningMockBridgeT): Promise<void> {
  await page.reload();
  await stopMockBridge(mock.process);
  await removeMockBridgeConfig(mock.configPath);
}
