import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { Result } from 'neverthrow';
import type { TestCaseMetadataT } from '../../test-case-metadata';

const CLASS_A: ClassDetails = {
  name: 'A',
  methods: [{
    name: 'run',
    overloads: [[{ arg: 'value', t: 'string' }]],
  }],
  relations: [],
};

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'decompiles and retrieves a class through the current model API',
  prompt: {
    availability: 'available',
    old: 'Verify Model.decompile and current.tryGetModel work with a stored class model.',
    history: [],
  },
};

export function registerModelDecompileLookupCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const model: Model = new Model();
    model.current.initClasses([CLASS_A]);
    const stored: Result<ClassDetails, Error> = model.current.tryGetModel('A');

    expect(stored.isOk()).toBe(true);
    if (stored.isOk()) expect(Model.decompile(stored.value)).toBe('A\n  run(value: string)');
    expect(model.current.tryGetModel('Missing').isErr()).toBe(true);
  });
}
