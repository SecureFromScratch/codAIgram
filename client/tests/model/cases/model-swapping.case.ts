import { expect, it } from 'vitest';
import { Model, type ClassWorkspaceModel } from '../../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

const CLASS_A: ClassDetails = { name: 'A', methods: [], relations: [] };

const CLASS_B: ClassDetails = { name: 'B', methods: [], relations: [] };

type ClassWorkspaceModelT = ClassWorkspaceModel;

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'keeps separately swappable model instances isolated',
  prompt: {
    availability: 'available',
    old: 'Verify Model.current can be swapped without sharing the class inventory.',
    history: [],
  },
};

export function registerModelSwappingCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const model: Model = new Model();
    const original: ClassWorkspaceModelT = model.current;
    original.initClasses([CLASS_A]);

    model.current = new Model().current;
    model.current.initClasses([CLASS_B]);

    expect(original.current.has('A')).toBe(true);
    expect(original.current.has('B')).toBe(false);
    expect(model.current.current.has('A')).toBe(false);
    expect(model.current.current.has('B')).toBe(true);
  });
}
