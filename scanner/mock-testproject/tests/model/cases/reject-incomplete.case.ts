import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'rejects incomplete relationships and headings',
  prompt: {
    availability: 'available',
    text: 'Show syntax errors for a missing class name and for an incomplete OWNS type.'
  }
};

export function registerRejectIncompleteCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(parseDiagram('')).toMatchObject({ ok: false });
    expect(parseDiagram('Thing\nOWNS items:')).toMatchObject({ ok: false });
  });
}
