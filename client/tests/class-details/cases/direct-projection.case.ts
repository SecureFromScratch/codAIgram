import { expect, it } from 'vitest';
import { classDetailsToDiagramSet, type ClassDetails } from '../../../src/class-details';
import type { TestCaseMetadataT } from '../../test-case-metadata';
import type { Diagram } from '../../../src/model';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'projects scanned class details without reparsing them as DSL',
  prompt: {
    availability: 'available',
    old: 'Ensure externally scanned ClassDetails are projected directly to the graph at startup because scanner method names and structured types need not fit the provisional text DSL.'
  ,
    history: [],
  }
};

const DETAILS: readonly ClassDetails[] = [
  {
    name: 'StandardSchemaV1',
    methods: [{
      name: '~standard',
      overloads: [[{ arg: '+RO', t: 'unknown' }]]
    }],
    relations: [],
    },
  {
    name: 'ValueType',
    methods: [],
    relations: [{
      kind: 'UNK',
      name: 'description',
      target: 'ValueDescription',
      many: true
    }],
    }
];

export function registerDirectProjectionCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const diagram: Diagram | undefined = classDetailsToDiagramSet(DETAILS);
    expect(diagram).toEqual({
      title: 'StandardSchemaV1',
      members: ['  ~standard: unknown'],
      targets: [],
      classes: [{
        title: 'ValueType',
        members: [],
        targets: [{
          kind: 'UNK',
          name: 'description',
          target: 'ValueDescription',
          multiplicity: 'many'
        }]
      }]
    });
  });
}
