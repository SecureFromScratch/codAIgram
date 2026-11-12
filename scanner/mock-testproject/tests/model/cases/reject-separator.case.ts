import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'rejects missing separators, property colons and types, and duplicate class names',
  prompt: {
    availability: 'available',
    text: 'Validate the DSL: classes require a blank-line separator and properties require a colon and a type.'
  }
};

export function registerRejectSeparatorCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    ['Diagram\n  f()\nClass\n  x: bool', 'Diagram\n  property bool', 'Diagram\n  property:', 'Diagram\n\nDiagram'].forEach((text: string) => { expect(parseDiagram(text)).toMatchObject({ ok: false }); });
  });
}
