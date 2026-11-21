import { expect, it } from 'vitest';
import { Model } from '../../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'initializes inventory and notifies subscribers when a class is removed',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/18 00:00', text: 'Test that the model initializes and replaces its class inventory and emits a removal notification.' }],
  },
};

const CLASS_A: ClassDetails = {
  name: 'A',
  methods: [{ name: 'run', overloads: [[]] }],
  relations: [],
};

export function registerModelInventoryCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const model: Model = new Model();
    const events: string[] = [];
    model.current.subscribe([], (change) => events.push(`${change.classId}:${change.attribute}`));
    model.current.initClasses([CLASS_A]);
    model.current.initClasses([]);
    expect(model.current.current.size).toBe(0);
    expect(events).toContain('A:removed');
  });
}

