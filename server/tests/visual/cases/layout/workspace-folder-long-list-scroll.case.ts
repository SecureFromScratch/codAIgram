import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { closeProjectFoldersPopup, connectAndOpenProjectFolders, getProjectFolders, MANY_PROJECT_FOLDERS, scrollProjectFolderScrollbar, type ConnectedWorkspacePopupT, type ProjectFolderT } from '../../semantic-project-folders.js';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface ScrollMetrics {
  scrollHeight: number;
  clientHeight: number;
}

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'scrolls a long workspace folder list to its final entry',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/20 09:35', text: 'Visual test on a long list of 15 projects/folders: a scrollbar appears, can be scrolled, and the last project and folder can be viewed.' }],
  },
};

export function registerWorkspaceFolderLongListScrollCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const setup: ConnectedWorkspacePopupT = await connectAndOpenProjectFolders(MANY_PROJECT_FOLDERS);
    try {
      const list: Locator = setup.dialog.locator('.vscode-workspace-list');
      const scrollMetrics: ScrollMetrics = await list.evaluate((element: HTMLElement) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }));
      assert.ok(scrollMetrics.scrollHeight > scrollMetrics.clientHeight, 'the folder list should have a vertical scrollbar');
      const scrollTop: number = await scrollProjectFolderScrollbar('down', 10_000);
      assert.ok(scrollTop > 0, 'the folder list should scroll down');
      const lastFolder: ProjectFolderT | undefined = MANY_PROJECT_FOLDERS.at(-1);
      assert.ok(lastFolder);
      const lastItem: Locator = list.locator('li').filter({ hasText: lastFolder.name });
      await lastItem.waitFor({ state: 'visible' });
      // UNTRUST-ALLOW-NULLISH: Playwright can return null when a locator has no rendered rectangle; the assertions below require both measured elements before comparing their visible bounds.
      const itemBounds: Bounds | null = await lastItem.boundingBox();
      // UNTRUST-ALLOW-NULLISH: A missing list rectangle means the dialog did not lay out; assert it before using its scrollport bounds in the visibility check.
      const listBounds: Bounds | null = await list.boundingBox();
      assert.ok(itemBounds && listBounds);
      assert.ok(itemBounds.y >= listBounds.y && itemBounds.y + itemBounds.height <= listBounds.y + listBounds.height, 'the final workspace should be inside the visible scroll area');
      const folders: readonly ProjectFolderT[] = await getProjectFolders();
      assert.equal(folders.at(-1)?.name, lastFolder.name);
    } finally {
      await closeProjectFoldersPopup(setup.mock);
    }
  });
}
