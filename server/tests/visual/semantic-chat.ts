import type { Locator } from 'playwright';
import { page } from './test-support.js';
import { logAndThrow } from './logging.js';

type BridgeConnectionOutcomeT = 'connected' | 'failed';

export type ChatWorkspaceSelectionT = {
  readonly aiSupportingFolderNames: readonly string[];
  readonly workFolderNames: readonly string[];
};

export async function openChatPanel(): Promise<Locator> {
  await page.getByRole('button', { name: 'Toggle chat panel' }).click();
  const chat: Locator = page.getByRole('complementary', { name: 'Chat panel' });
  await chat.waitFor({ state: 'visible' });
  return chat;
}

export async function connectToBridgeFromSettings(connectionUrl: string, selection?: ChatWorkspaceSelectionT): Promise<readonly string[]> {
  const projectSelector: Locator = page.getByRole('combobox', { name: 'Current project' });
  await projectSelector.hover();
  await page.getByRole('button', { name: 'Project settings' }).click();
  const settings: Locator = page.getByRole('dialog', { name: 'VS Code workspaces' });
  await settings.getByRole('textbox', { name: 'VS Code bridge link' }).fill(connectionUrl);
  await settings.getByRole('button', { name: 'Connect' }).click();
  const workspaceList: Locator = settings.locator('.vscode-workspace-list');
  const connectionError: Locator = settings.getByRole('alert');
  const connectionOutcome: BridgeConnectionOutcomeT = await Promise.race([
    workspaceList.waitFor({ state: 'visible' }).then(() => 'connected' as const),
    connectionError.waitFor({ state: 'visible' }).then(() => 'failed' as const),
  ]);
  if (connectionOutcome === 'failed') {
    const errorText: string = (await connectionError.innerText()).trim();
    logAndThrow(new Error(`Could not connect to the VS Code bridge: ${errorText}`));
  }
  const workspaceNames: string[] = await settings.locator('.vscode-workspace-list li strong').allTextContents();
  if (selection) {
    for (let index: number = 0; index < selection.aiSupportingFolderNames.length; index++) {
      const folderName: string = selection.aiSupportingFolderNames[index] as string;
      await settings.getByRole('button', { 
        name: `Cycle selection for ${folderName}` 
      }).click();
    }
    for (let index: number = 0; index < selection.workFolderNames.length; index++) {
      const folderName: string = selection.workFolderNames[index] as string;
      await settings.getByRole('checkbox', { name: folderName }).check();
    }
  }
  await settings.getByRole('button', { name: 'Close VS Code bridge settings' }).click();
  await settings.waitFor({ state: 'hidden' });
  return workspaceNames;
}
