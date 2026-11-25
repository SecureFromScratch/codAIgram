import { test } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { runMockChatResponseScenario } from './chat-bridge-support.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'returns the configured response to a chat prompt through the mock bridge',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/21 09:35', text: 'Send the exact ClassDetails.methods type question through mock-bridge and verify that its configured ClassMember[] response appears.' },
      { when: '2026/11/23 09:35', text: 'Assert the request sends the first selected AI-supporting folder as cwd and all other selected folders in workFolders.' },
      { when: '2026/11/23 09:35', text: 'Select two Codex-supporting folders and one reference folder; require the mock bridge to return its response only when cwd and workFolders exactly match the selection rule.' },
    ],
  },
};

export function registerMockChatResponseCase(): void {
  test(TEST_CASE_METADATA.title, runMockChatResponseScenario);
}
