import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'accepts blank lines and properly indented multiline signatures',
  prompt: {
    availability: 'available',
    text: 'Allow blank space and multiline methods when continuation lines are indented by at least four spaces.'
  }
};

export function registerValidMultilineCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(parseDiagram('\nDiagram\n\n  add(\n    first: string,\n\n      second: integer\n    )\n\nOWNS items: Item[]')).toEqual({
      ok: true,
      diagram: {
        title: 'Diagram',
        members: ['add( first: string, second: integer )'],
        targets: [{
          kind: 'OWNS',
          name: 'items',
          target: 'Item',
          multiplicity: 'many'
        }]
      }
    });
  });
}
