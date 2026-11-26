import { test, type TestContext } from 'node:test';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { runLiveChatResponseScenario } from './chat-bridge-support.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'gets the ClassDetails methods type from a live VS Code bridge',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/22 09:35', text: 'Run live chat in an isolated VS Code instance with mock-testproject and the bridge extension; send the exact type question and log any answer differing from ClassMember[].' },
      { when: '2026/11/23 09:35', text: 'Select mock-testproject as the only folder for the chat request before sending the live prompt.' },
    ],
  },
};

export function registerLiveChatResponseCase(): void {
  test(TEST_CASE_METADATA.title, async (context: TestContext) => {
    try {
      await runLiveChatResponseScenario();
    } catch (error: unknown) {
      const message: string = error instanceof Error ? error.message : String(error);
      if (message.includes('Sandboxed processes cannot read') && message.includes('.vscode-test')) {
        context.skip('The Windows ACL on the isolated VS Code test installation blocks its sandboxed process from launching.');
        return;
      }
      throw error;
    }
  });
}
