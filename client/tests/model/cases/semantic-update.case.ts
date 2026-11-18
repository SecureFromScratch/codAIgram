import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'updates semantic data when the text changes',
  prompt: {
    availability: 'available',
    old: 'Make the graph representation update dynamically when diagram text changes.'
  ,
    history: [],
  }
};

export function registerSemanticUpdateCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(parseDiagram('Package\n  ship()\nOWNS items: Item[]')).toEqual({
      ok: true,
      diagram: {
        title: 'Package',
        members: ['ship()'],
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
