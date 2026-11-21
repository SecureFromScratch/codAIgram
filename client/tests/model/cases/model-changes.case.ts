import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'tracks attribute changes and clears history when values return to their original state',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/18 00:00', text: 'Verify model attribute history records a change and is removed when the value returns to its initial value.' }],
  },
};

const CLASS_A: ClassDetails = {
  name: 'A',
  sourceFile: 'initial.ts',
  methods: [{ name: 'run', overloads: [[]] }],
  relations: [],
};

export function registerModelChangesCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const model: Model = new Model();
    model.current.initClasses([CLASS_A]);
    model.current.updateClasses([{
      name: 'A',
      sourceFile: 'a.ts',
      methods: [{ name: 'run', overloads: [[]] }],
      relations: [],
    }]);
    expect(model.current.changes.get('A')?.get('sourceFile')).toEqual(['initial.ts', 'a.ts']);
    model.current.updateClasses([CLASS_A]);
    expect(model.current.changes.get('A')?.has('sourceFile')).toBe(false);
  });
}

