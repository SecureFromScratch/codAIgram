import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'rejects incorrectly indented and incomplete methods',
  prompt: {
    availability: 'available',
    text: 'Require methods to be indented two spaces and multiline method continuations to use at least four spaces.'
  }
};

export function registerRejectMethodCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    ['Diagram\nadd()', 'Diagram\n   add()', 'Diagram\n  add(\n  first: string)', 'Diagram\n  add('].forEach((text: string): void => { expect(parseDiagram(text)).toMatchObject({ ok: false }); });
  });
}
