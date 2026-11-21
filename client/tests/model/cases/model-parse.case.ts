import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'parses class descriptions and returns parse errors for invalid text',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/18 00:00', text: 'Test that Model.parse converts a valid class description to ClassDetails and returns an error for invalid text.' }],
  },
};

export function registerModelParseCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    expect(Model.parse('Thing\n  run(value: string)')).toEqual({
      name: 'Thing',
      methods: [{
        name: 'run',
        overloads: [[{ arg: 'value', t: 'string' }]],
      }],
      relations: [],
    });
    expect(Model.parse('not a valid class')).toBeInstanceOf(Error);
  });
}

