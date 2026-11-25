import type { RevisionResult } from "../../../dist/class-revision.js";
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { rebuildClassHistory, reviseClass } from '../../../dist/class-revision.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { parseStoredClassRevision, parseStoredClassSnapshot } from '../../../dist/class-storage-schema.js';
import type { ClassRevision, ClassUpdate } from '../../../dist/class-revision.js';
import { INITIAL, SCAN, USER } from '../support/class-revision-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "preserves provenance and produces no delta for unchanged snapshots",
  prompt: {
    availability: 'available',
    old: "Track class changes and deletions under one originator per complete update.",
    history: [
      { when: "2026/11/15 09:35", text: "calling updateClasses is with a SINGLE originatoor type, name, version tag (usually a timestamp).\nall changes in that updated are attributed to them - including the deletion.\nin fact - a good storage structure will hold the current state in one document type and the history in another, where history only has the originators name etc once. this is a bit like git - current version on top and deltas going back" },
    ],
  },
};

export function registerRevisionIdempotenceCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    // UNTRUST-ALLOW-NULLISH: This case creates the class's first revision, so the reducer must receive no previous snapshot and record an initial state.
    const created: RevisionResult = reviseClass(INITIAL, undefined, SCAN);
    const repeated: RevisionResult = reviseClass(INITIAL, created.current, USER);
    assert.equal(created.changes.length, 2);
    assert.deepEqual(repeated.current, created.current);
    assert.deepEqual(repeated.changes, []);
  });
}
