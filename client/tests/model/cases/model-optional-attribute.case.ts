import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

const CLASS_WITH_SOURCE: ClassDetails = {
  name: 'A',
  sourceFile: 'a.ts',
  methods: [],
  relations: [],
};

const CLASS_WITHOUT_SOURCE: ClassDetails = { name: 'A', methods: [], relations: [] };

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'clears optional attribute history when it returns to the baseline',
  prompt: {
    availability: 'available',
    old: 'Ensure omitting an optional class attribute is detected and its reverted history is cleared.',
    history: [],
  },
};

export function registerModelOptionalAttributeCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const model: Model = new Model();
    model.current.initClasses([CLASS_WITH_SOURCE]);

    model.current.updateClasses([CLASS_WITHOUT_SOURCE]);

    expect(model.current.current.get('A')?.sourceFile).toBeUndefined();
    expect(model.current.changes.get('A')?.has('sourceFile')).toBe(false);
  });
}
