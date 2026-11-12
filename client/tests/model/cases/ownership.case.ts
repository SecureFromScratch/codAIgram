import { expect, it } from 'vitest';
import { parseDiagram } from '../../../src/model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'parses OWNS, REF, and UNK class connections',
  prompt: {
    availability: 'available',
    text: 'Support OWNS, REF, and UNK relationship keywords with single and many arities, unnamed references, and incomplete targets.'
  }
};

export function registerOwnershipCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(parseDiagram('Diagram\nOWNS item: Item')).toMatchObject({
      ok: true,
      diagram: {
        targets: [{
          kind: 'OWNS',
          name: 'item',
          target: 'Item',
          multiplicity: 'one'
        }]
      }
    });
    expect(parseDiagram('Diagram\nOWNS Item[]')).toMatchObject({
      ok: true,
      diagram: {
        targets: [{
          kind: 'OWNS',
          name: '',
          target: 'Item',
          multiplicity: 'many'
        }]
      }
    });
    expect(parseDiagram('Diagram\nREF reference: Referenced')).toMatchObject({
      ok: true,
      diagram: {
        targets: [{
          kind: 'REF',
          name: 'reference',
          target: 'Referenced',
          multiplicity: 'one'
        }]
      }
    });
    expect(parseDiagram('Diagram\nUNK unknown: Unknown[]')).toMatchObject({
      ok: true,
      diagram: {
        targets: [{
          kind: 'UNK',
          name: 'unknown',
          target: 'Unknown',
          multiplicity: 'many'
        }]
      }
    });
    expect(parseDiagram('Diagram\nOWNS item:')).toMatchObject({
      ok: false,
      diagram: {
        targets: [{
          kind: 'OWNS',
          name: 'item',
          target: '?',
          multiplicity: 'one'
        }]
      }
    });
    expect(parseDiagram('Diagram\nitem: Item[]')).toMatchObject({
      ok: false,
      partialRetention: 'retain',
      diagram: { targets: [] }
    });
  });
}
