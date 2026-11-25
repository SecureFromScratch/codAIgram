import type { RevisionResult, ClassHistory, HistoryMember } from "../../../dist/class-revision.js";
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { rebuildClassHistory, reviseClass } from '../../../dist/class-revision.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { parseStoredClassRevision, parseStoredClassSnapshot } from '../../../dist/class-storage-schema.js';
import type { ClassRevision, ClassUpdate } from '../../../dist/class-revision.js';
import { INITIAL, SCAN, USER } from '../support/class-revision-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "reconstructs renamed and deleted entries while storing each revision origin only once",
  prompt: {
    availability: 'available',
    old: "Track class changes and deletions under one originator per complete update.",
    history: [
      { when: "2026/11/15 09:35", text: "calling updateClasses is with a SINGLE originatoor type, name, version tag (usually a timestamp).\nall changes in that updated are attributed to them - including the deletion.\nin fact - a good storage structure will hold the current state in one document type and the history in another, where history only has the originators name etc once. this is a bit like git - current version on top and deltas going back" },
    ],
  },
};

export function registerRevisionReconstructionCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    // UNTRUST-ALLOW-NULLISH: This case creates the class's first revision, so the reducer must receive no previous snapshot and record an initial state.
    const created: RevisionResult = reviseClass(INITIAL, undefined, SCAN);
    const edited: ClassUpdate = {
      name: 'Notebook',
      methods: [{
        name: 'search',
        modifies: 'find',
        overloads: [{ args: [{ arg: 'key', t: 'string' }] }]
      }],
      relations: [],
      
    };
    const changed: RevisionResult = reviseClass(edited, created.current, USER);
    assert.deepEqual(reviseClass(edited, changed.current, USER).changes, []);
    const removed: RevisionResult = reviseClass({ name: 'Notebook', methods: [], relations: [], }, changed.current, USER);
    const revisions: ClassRevision[] = [
      {
        origin: SCAN,
        when: '2026-11-15T09:35:00Z',
        changes: created.changes
      },
      {
        origin: USER,
        when: '2026-11-15T09:36:00Z',
        changes: changed.changes
      },
      {
        origin: USER,
        when: '2026-11-15T09:37:00Z',
        changes: removed.changes
      },
    ];
    const history: ClassHistory = rebuildClassHistory(removed.current, revisions);
    const member: HistoryMember | undefined = history.methods.find((item) => item.name === 'search');
    assert.equal(member?.status, 'deleted');
    assert.deepEqual(member?.history.map((item) => item.origin.name), ['scanner', 'alice', 'alice']);
    assert.deepEqual(member?.history.map((item) => item.when), ['2026-11-15T09:35:00Z', '2026-11-15T09:36:00Z', '2026-11-15T09:37:00Z']);
    assert.deepEqual(member?.history.map((item) => item.value === 'deleted' ? item.value : item.value.name), ['find', 'search', 'deleted']);
    assert.equal(member?.overloads[0]?.status, 'deleted');
    assert.equal(member?.overloads[0]?.history.at(-1)?.value, 'deleted');
    assert.equal(history.relations[0]?.status, 'deleted');
    assert.equal(JSON.stringify(revisions[1]?.changes).includes('alice'), false);
  });
}
