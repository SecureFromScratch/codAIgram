import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { logAndThrow, logVisualEvent } from '../../logging.js';
import { page } from '../../test-support.js';
import { connectToBridgeFromSettings, openChatPanel } from '../../semantic-chat.js';
import { startLiveVscodeHost, stopLiveVscodeHost, type RunningLiveVscodeHostT } from '../../support/live-vscode-host.js';
import { removeMockBridgeConfig, startMockBridgeWithFolders, stopMockBridge, type MockWorkspaceT, type RunningMockBridgeT } from '../../support/mock-bridge.js';

export const CHAT_PROMPT: string = 'What is the type of the methods field in interface ClassDetails? reply only with the type, i.e. "number", "Date[]", etc';
export const EXPECTED_CHAT_RESPONSE: string = 'ClassMember[]';
export const TEST_WORKSPACES: readonly MockWorkspaceT[] = [
  { 
    name: 'chat-ai-project', 
    uri: 'file:///workspace/chat-ai-project', 
    index: 0, 
    configuredAgents: ['codex'] 
  },
  { 
    name: 'chat-ai-secondary-project', 
    uri: 'file:///workspace/chat-ai-secondary-project', 
    index: 1,
    configuredAgents: ['codex']
  },
  { 
    name: 'chat-reference-project', 
    uri: 'file:///workspace/chat-reference-project', 
    index: 2 
  },
];

type LivePromptOutcomeT = 'response' | 'error';

export async function runDisconnectedChatScenario(): Promise<void> {
  const chat: Locator = await openChatPanel();
  await chat.getByRole('textbox', { name: 'Message' }).fill(CHAT_PROMPT);
  assert.equal(await chat.getByRole('button', { name: 'Send' }).isDisabled(), true);
  assert.ok(await chat.getByText('You must connect to vscode first', { exact: true }).isVisible());
  await chat.getByRole('button', { name: 'Connect' }).click();
  await page.getByRole('dialog', { name: 'VS Code workspaces' }).waitFor({ state: 'visible' });
}

export async function runConnectedChatScenario(): Promise<void> {
  const mock: RunningMockBridgeT = await startMockBridgeWithFolders(TEST_WORKSPACES);
  try {
    await connectToBridgeFromSettings(mock.connectionUrl);
    const chat: Locator = await openChatPanel();
    await chat.getByRole('textbox', { name: 'Message' }).fill(CHAT_PROMPT);
    assert.equal(await chat.getByRole('button', { name: 'Send' }).isEnabled(), true);
  } finally {
    await page.reload();
    await stopMockBridge(mock.process);
    removeMockBridgeConfig(mock.configPath);
  }
}

export async function runMockChatResponseScenario(): Promise<void> {
  const mock: RunningMockBridgeT = await startMockBridgeWithFolders(TEST_WORKSPACES, 0, [
    {
      prompt: CHAT_PROMPT,
      response: EXPECTED_CHAT_RESPONSE,
      expectedCwd: '/workspace/chat-ai-project',
      expectedWorkFolders: [
        '/workspace/chat-ai-secondary-project',
        '/workspace/chat-reference-project'
      ],
    },
  ]);
  try {
    await connectToBridgeFromSettings(mock.connectionUrl, {
      aiSupportingFolderNames: [
        'chat-ai-project',
        'chat-ai-secondary-project'
      ],
      workFolderNames: ['chat-reference-project'],
    });
    const chat: Locator = await openChatPanel();
    await chat.getByRole('textbox', { name: 'Message' }).fill(CHAT_PROMPT);
    await chat.getByRole('button', { name: 'Send' }).click();
    await chat.getByText(EXPECTED_CHAT_RESPONSE, { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await chat.getByText(EXPECTED_CHAT_RESPONSE, { exact: true }).textContent(), EXPECTED_CHAT_RESPONSE);
  } finally {
    await page.reload();
    await stopMockBridge(mock.process);
    removeMockBridgeConfig(mock.configPath);
  }
}

export async function runLiveChatResponseScenario(): Promise<void> {
  const host: RunningLiveVscodeHostT = await startLiveVscodeHost();
  try {
    const workspaces: readonly string[] = await connectToBridgeFromSettings(host.connectionUrl, {
      aiSupportingFolderNames: ['mock-testproject'],
      workFolderNames: [],
    });
    assert.ok(workspaces.includes('mock-testproject'), 'The isolated VS Code host must have mock-testproject open.');
    const chat: Locator = await openChatPanel();
    await chat.getByRole('textbox', { name: 'Message' }).fill(CHAT_PROMPT);
    await chat.getByRole('button', { name: 'Send' }).click();
    const response: Locator = chat.locator('[data-chat-role="assistant"]').last();
    const chatError: Locator = chat.getByRole('alert');
    const promptOutcome: LivePromptOutcomeT = await Promise.race([
      response.waitFor({ state: 'visible', timeout: 120_000 }).then(() => 'response' as const),
      chatError.waitFor({ state: 'visible', timeout: 120_000 }).then(() => 'error' as const),
    ]);
    if (promptOutcome === 'error') logAndThrow(new Error(`The live Codex request failed: ${(await chatError.innerText()).trim()}`));
    const actualResponse: string = (await response.textContent())?.trim() ?? '';
    if (actualResponse !== EXPECTED_CHAT_RESPONSE) {
      logVisualEvent('ERROR', `LIVE_CHAT_RESPONSE_MISMATCH expected=${JSON.stringify(EXPECTED_CHAT_RESPONSE)} actual=${JSON.stringify(actualResponse)}`);
    }
    assert.equal(actualResponse, EXPECTED_CHAT_RESPONSE);
  } finally {
    await stopLiveVscodeHost(host);
  }
}
