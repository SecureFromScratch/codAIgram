import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

const CLASS_A: ClassDetails = { name: 'A', methods: [], relations: [] };

const CLASS_B: ClassDetails = { name: 'B', methods: [], relations: [] };

const UPDATED_CLASS_A: ClassDetails = { name: 'A', usage: 'dto', methods: [], relations: [] };

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'updates supplied classes and notifies matching subscribers only',
  prompt: {
    availability: 'available',
    old: 'Check partial model updates preserve other classes and notify filtered listeners.',
    history: [],
  },
};

export function registerModelUpdateScopeCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const model: Model = new Model();
    model.current.initClasses([CLASS_A, CLASS_B]);
    const received: string[] = [];
    model.current.subscribe(['A'], (change) => received.push(change.classId));

    model.current.updateClasses([UPDATED_CLASS_A]);

    expect(model.current.current.has('A')).toBe(true);
    expect(model.current.current.has('B')).toBe(true);
    expect(model.current.current.get('A')?.usage).toBe('dto');
    expect(received).toEqual(['A']);
  });
}
