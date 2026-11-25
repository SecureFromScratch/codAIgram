import { expect, it } from 'vitest';
import type { WorkspaceFolder } from '@codaigram/bridge-protocol/client';
import { buildChatPromptOptions } from '../src/chat-workspace';
import type { TestCaseMetadataT } from './test-case-metadata';

const WORKSPACES: readonly WorkspaceFolder[] = [
  {
    name: 'one',
    uri: 'file:///C:/work/one',
    index: 0,
    configuredAgents: ['codex'],
  },
  {
    name: 'two',
    uri: 'file:///C:/work/two',
    index: 1,
    configuredAgents: ['codex'],
  },
  {
    name: 'three',
    uri: 'file:///C:/work/three',
    index: 2,
    configuredAgents: [],
  },
];
const FIRST_WORKSPACE_URI: string = 'file:///C:/work/one';
const SECOND_WORKSPACE_URI: string = 'file:///C:/work/two';
const THIRD_WORKSPACE_URI: string = 'file:///C:/work/three';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'sends the selected AI folder as cwd and all selected folders as work folders',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/23 09:35', text: 'When calling the bridge prompt method, send cwd and workFolders. Prefer the sole selected AI-supporting folder as cwd; if multiple are selected use the first AI-supporting folder; if none are selected use the first selected folder, or the first available folder as fallback.' }],
  },
};

export function registerChatWorkspaceOptionsCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(buildChatPromptOptions(WORKSPACES, [THIRD_WORKSPACE_URI], [SECOND_WORKSPACE_URI])).toEqual({ cwd: 'C:/work/two', workFolders: ['C:/work/three'] });
    expect(buildChatPromptOptions(WORKSPACES, [], [SECOND_WORKSPACE_URI, FIRST_WORKSPACE_URI])).toEqual({ cwd: 'C:/work/one', workFolders: ['C:/work/two'] });
    expect(buildChatPromptOptions(WORKSPACES, [THIRD_WORKSPACE_URI, SECOND_WORKSPACE_URI], [])).toEqual({ cwd: 'C:/work/two', workFolders: ['C:/work/three'] });
    expect(buildChatPromptOptions(WORKSPACES, [], [])).toEqual({
      cwd: 'C:/work/one',
      workFolders: ['C:/work/two', 'C:/work/three'],
    });
  });
}
