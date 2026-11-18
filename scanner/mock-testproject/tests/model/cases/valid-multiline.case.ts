import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'accepts blank lines and properly indented multiline signatures',
  prompt: {
    availability: 'available',
    old: 'Allow blank space and multiline methods when continuation lines are indented by at least four spaces.'
  ,
    history: [
      { when: "2026/11/15 09:35", text: "text editor: start without empty new line separators, but newlines are allowed and do not change meaning. empty space in general is allowed, but methods must be indented 2 spaces and there should be no line wrap. instead - methods can be split between lines like in java/python but indent of continuation lines must be at least 4 spaces." },
    ],
  }
};

export function registerValidMultilineCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(parseDiagram('\nDiagram\n\n  add(\n    first: string,\n\n      second: integer\n    )\n\nOWNS items: Item[]')).toEqual({
      ok: true,
      diagram: {
        title: 'Diagram',
        members: ['add( first: string, second: integer )'],
        targets: [{ name: 'items', target: 'Item', multiplicity: 'many' }] } });
  });
}
