import assert from 'node:assert/strict';
import { it } from 'node:test';
import { rebuildClassHistory, reviseClass } from '../../../dist/class-revision.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { parseStoredClassRevision, parseStoredClassSnapshot } from '../../../dist/class-storage-schema.js';
import type { ClassRevision, ClassUpdate } from '../../../dist/class-revision.js';
import { INITIAL, SCAN, USER } from '../support/class-revision-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "records omitted items as deltas while retaining unchanged overload origins",
  prompt: {
    availability: 'available',
    old: "Track class changes and deletions under one originator per complete update.",
    history: [
      { when: "2026/11/15 09:35", text: "calling updateClasses is with a SINGLE originatoor type, name, version tag (usually a timestamp).\nall changes in that updated are attributed to them - including the deletion.\nin fact - a good storage structure will hold the current state in one document type and the history in another, where history only has the originators name etc once. this is a bit like git - current version on top and deltas going back" },
    ],
  },
};

export function registerRevisionDeletionsCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const created = reviseClass(INITIAL, undefined, SCAN);
    const updated: ClassUpdate = {
      name: 'Notebook',
      methods: [{
        name: 'find',
        overloads: [
          { args: [{ arg: 'key', t: 'string' }] },
          { args: [{ arg: 'index', t: 'number' }] },
        ],
      }],
      relations: [],
      
    };
    const revised = reviseClass(updated, created.current, USER);
    assert.equal(revised.current.methods[0]?.origin.name, 'alice');
    assert.equal(revised.current.methods[0]?.overloads[0]?.origin.name, 'scanner');
    assert.equal(revised.current.methods[0]?.overloads[1]?.origin.name, 'alice');
    assert.ok(revised.changes.some((change) => change.kind === 'relation' && change.after === 'absent'));
    assert.equal(JSON.stringify(revised.changes).includes('scanner'), false);
  });
}
