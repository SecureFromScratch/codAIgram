import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { closeProjectFoldersPopup, connectAndOpenProjectFolders, MANY_PROJECT_FOLDERS, type ConnectedWorkspacePopupT } from '../../semantic-project-folders.js';
import { page } from '../../test-support.js';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'keeps the long workspace folder popup above the bottom screen margin',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/20 09:35', text: 'Visual test on a long list of 15 projects/folders: the popup bottom does not reach the bottom of the screen and retains a margin.' }],
  },
};

export function registerWorkspaceFolderPopupMarginCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const setup: ConnectedWorkspacePopupT = await connectAndOpenProjectFolders(MANY_PROJECT_FOLDERS);
    try {
      // UNTRUST-ALLOW-NULLISH: A dialog without a bounding rectangle is not laid out and cannot satisfy the screen-margin assertion below; the next assertion narrows this optional measurement.
      const bounds: Bounds | null = await setup.dialog.boundingBox();
      // UNTRUST-ALLOW-NULLISH: Playwright may report no viewport if the test page is closed; assert a live viewport before checking the bottom margin and using its height.
      const viewport: { width: number; height: number } | null = page.viewportSize();
      assert.ok(bounds && viewport);
      assert.ok(bounds.y + bounds.height <= viewport.height - 20, 'the popup should leave at least 20px below it');
    } finally {
      await closeProjectFoldersPopup(setup.mock);
    }
  });
}
