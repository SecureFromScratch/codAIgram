import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { closeProjectFoldersPopup, connectAndOpenProjectFolders, SAMPLE_PROJECT_FOLDER, type ConnectedWorkspacePopupT } from '../../semantic-project-folders.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'removes a duplicate project name suffix from workspace paths',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/20 09:35', text: 'Visual test after successful mock-bridge connection: if a file path terminates with the same folder name as the project, remove that suffix from the displayed file path.' }],
  },
};

export function registerWorkspaceFolderTrimsProjectSuffixCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const setup: ConnectedWorkspacePopupT = await connectAndOpenProjectFolders([SAMPLE_PROJECT_FOLDER]);
    try {
      const displayedPath: string = await setup.dialog.locator('.vscode-workspace-list li span').innerText();
      assert.equal(displayedPath, 'c:/Users/yariv/Source/Effective/codAIgram');
    } finally {
      await closeProjectFoldersPopup(setup.mock);
    }
  });
}
