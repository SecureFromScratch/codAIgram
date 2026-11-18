import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'rejects incorrectly indented and incomplete methods',
  prompt: {
    availability: 'available',
    old: 'Require methods to be indented two spaces and multiline method continuations to use at least four spaces.'
  ,
    history: [
      { when: "2026/11/15 09:35", text: "text editor: start without empty new line separators, but newlines are allowed and do not change meaning. empty space in general is allowed, but methods must be indented 2 spaces and there should be no line wrap. instead - methods can be split between lines like in java/python but indent of continuation lines must be at least 4 spaces." },
    ],
  }
};

export function registerRejectMethodCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    ['Diagram\nadd()', 'Diagram\n   add()', 'Diagram\n  add(\n  first: string)', 'Diagram\n  add('].forEach((text: string) => { expect(parseDiagram(text)).toMatchObject({ ok: false }); });
  });
}
