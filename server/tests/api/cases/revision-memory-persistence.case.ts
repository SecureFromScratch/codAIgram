import assert from 'node:assert/strict';
import { it } from 'node:test';
import { rebuildClassHistory, reviseClass } from '../../../dist/class-revision.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { parseStoredClassRevision, parseStoredClassSnapshot } from '../../../dist/class-storage-schema.js';
import type { ClassRevision, ClassUpdate } from '../../../dist/class-revision.js';
import { INITIAL, SCAN, USER } from '../support/class-revision-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "keeps current snapshots and deletion history separately in memory",
  prompt: {
    availability: 'available',
    old: "Track class changes and deletions under one originator per complete update.",
    history: [
      { when: "2026/11/15 09:35", text: "calling updateClasses is with a SINGLE originatoor type, name, version tag (usually a timestamp).\nall changes in that updated are attributed to them - including the deletion.\nin fact - a good storage structure will hold the current state in one document type and the history in another, where history only has the originators name etc once. this is a bit like git - current version on top and deltas going back" },
      { when: "2026/11/16 11:00", text: "internally, in storage, assign each new class a unique id (guid, no need for cryptographically random - use fastest guid version generation avaiable, but comment that it is NOT cryptosafe, in fact - its field should have the words nonCryptoGuid). for historical revisions add the id field as well." },
    ],
  },
};

export function registerRevisionMemoryPersistenceCase(): void {
  it(TEST_CASE_METADATA.title, async () => {
    const repository = new MemoryClassRepository([]);
    await repository.updateClassSnapshots("mock-project", [INITIAL], SCAN);
    const first = await repository.getClassSnapshots("mock-project");
    assert.match(first[0]?.nonCryptoGuid ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await repository.updateClassSnapshots("mock-project", [INITIAL], USER);
    assert.deepEqual(await repository.getClassSnapshots("mock-project"), first);
    await repository.updateClassSnapshots("mock-project", [{
      name: 'Notebook',
      methods: [],
      relations: [],
      }], USER);
    const history = await repository.getClassHistory("mock-project", ['Notebook']);
    assert.equal((await repository.getClassSnapshots("mock-project"))[0]?.nonCryptoGuid, first[0]?.nonCryptoGuid);
    assert.equal(history[0]?.methods[0]?.status, 'deleted');
    assert.equal(history[0]?.relations[0]?.status, 'deleted');
    assert.deepEqual(history[0]?.methods[0]?.history.map((item) => item.origin.name), ['scanner', 'alice']);
  });
}
