import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { closeProjectFoldersPopup, connectAndOpenProjectFolders, SAMPLE_PROJECT_FOLDER, type ConnectedWorkspacePopupT } from '../../semantic-project-folders.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'shows workspace folder paths without the file URL scheme',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/20 09:35', text: 'Visual test after successful mock-bridge connection: file folder paths do not contain the file:// prefix.' }],
  },
};

export function registerWorkspaceFolderNoFileSchemeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const setup: ConnectedWorkspacePopupT = await connectAndOpenProjectFolders([SAMPLE_PROJECT_FOLDER]);
    try {
      const displayedPath: string = await setup.dialog.locator('.vscode-workspace-list li span').innerText();
      assert.doesNotMatch(displayedPath, /^file:\/\//i);
      assert.match(displayedPath, /^c:\//i);
    } finally {
      await closeProjectFoldersPopup(setup.mock);
    }
  });
}
