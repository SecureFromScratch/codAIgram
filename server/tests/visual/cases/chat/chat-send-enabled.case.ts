import { test } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { runConnectedChatScenario } from './chat-bridge-support.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'enables chat sending after connecting to the VS Code bridge',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/21 09:35', text: 'After connecting to the VS Code bridge, entering a chat prompt enables the Send button.' }],
  },
};

export function registerConnectedChatCase(): void {
  test(TEST_CASE_METADATA.title, runConnectedChatScenario);
}
