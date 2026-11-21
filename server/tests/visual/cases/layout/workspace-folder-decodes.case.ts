import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { closeProjectFoldersPopup, connectAndOpenProjectFolders, SAMPLE_PROJECT_FOLDER, type ConnectedWorkspacePopupT } from '../../semantic-project-folders.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'decodes URL characters in workspace folder paths',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/20 09:35', text: 'Visual test after successful mock-bridge connection: file folder paths do not contain %XX encodings and are converted back to characters using URL decode.' }],
  },
};

export function registerWorkspaceFolderDecodesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const setup: ConnectedWorkspacePopupT = await connectAndOpenProjectFolders([SAMPLE_PROJECT_FOLDER]);
    try {
      const displayedPath: string = await setup.dialog.locator('.vscode-workspace-list li span').innerText();
      assert.doesNotMatch(displayedPath, /%[0-9a-f]{2}/i);
      assert.match(displayedPath, /codAIgram/);
    } finally {
      await closeProjectFoldersPopup(setup.mock);
    }
  });
}
