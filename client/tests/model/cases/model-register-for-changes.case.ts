import { expect, it } from 'vitest';
import { ClassWorkspaceModel, Model, type ModelChangeT } from '../../../src/workspace-model';
import type { ClassDetails } from '@codaigram/shared/class-types';
import type { TestCaseMetadataT } from '../../test-case-metadata';

const CLASS_A: ClassDetails = { name: 'A', methods: [], relations: [] };
const CLASS_A_UPDATED: ClassDetails = { name: 'A', usage: 'dto', methods: [], relations: [] };
const CLASS_B: ClassDetails = { name: 'B', methods: [], relations: [] };

export const TEST_CASE_METADATA: TestCaseMetadataT = {
  title: 'notifies registered change callbacks for updates, additions, and removals',
  prompt: {
    availability: 'available',
    old: 'Add Model.current.registerForChanges and verify callbacks receive class changes.',
    history: [],
  },
};

export function registerModelRegisterForChangesCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    Model.current = new ClassWorkspaceModel();
    Model.current.initClasses([CLASS_A]);
    const changes: ModelChangeT[] = [];
    Model.current.registerForChanges((change: ModelChangeT) => changes.push(change));

    Model.current.updateClasses([CLASS_A_UPDATED, CLASS_B]);
    Model.current.initClasses([CLASS_A_UPDATED]);

    expect(changes.some((change: ModelChangeT) => change.classId === 'A' && change.attribute === 'usage')).toBe(true);
    expect(changes.some((change: ModelChangeT) => change.classId === 'B' && change.attribute === 'name')).toBe(true);
    expect(changes.some((change: ModelChangeT) => change.classId === 'B' && change.attribute === 'removed')).toBe(true);
  });
}
