import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { Result } from 'neverthrow';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

const CLASS_A: ClassDetails = { name: 'A', methods: [], relations: [] };

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'looks up a class model from the current model by class name',
  prompt: {
    availability: 'available',
    old: 'Verify tryGetModel returns a Result from Model.current for the requested class.',
    history: [],
  },
};

export function registerModelClassLookupCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const model: Model = new Model();
    model.current.initClasses([CLASS_A]);

    const found: Result<ClassDetails, Error> = model.current.tryGetModel('A');
    expect(found.isOk()).toBe(true);
    if (found.isOk()) expect(found.value).toBe(model.current.current.get('A'));
    expect(model.current.tryGetModel('Missing').isErr()).toBe(true);
  });
}
