import { test } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { runDisconnectedChatScenario } from './chat-bridge-support.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'requires a VS Code bridge connection before sending a chat prompt',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/21 09:35', text: 'Opening the chat before connecting disables Send and shows a Connect button that opens the VS Code bridge popup.' }],
  },
};

export function registerDisconnectedChatCase(): void {
  test(TEST_CASE_METADATA.title, runDisconnectedChatScenario);
}
