import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createLocalFirestore, FirestoreClassRepository } from '../../../dist/firestore-repository.js';
import type { ClassOrigin, ClassUpdate } from '../../../dist/class-revision.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'retains both revision deltas when class updates overlap',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 09:35', text: 'calling updateClasses is with a SINGLE originatoor type, name, version tag (usually a timestamp). all changes in that updated are attributed to them - including the deletion. in fact - a good storage structure will hold the current state in one document type and the history in another, where history only has the originators name etc once.' },
    ],
  },
};

export function registerClassHistoryConcurrencyCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const database: FirebaseFirestore.Firestore = createLocalFirestore();
    const collection: string = `codaigram_concurrency_test_${randomUUID().replaceAll('-', '')}`;
    const base: ClassOrigin = { kind: 'scan', name: 'scanner', version: 'v1' };
    const alice: ClassOrigin = { kind: 'user', name: 'alice', version: 'v2' };
    const bob: ClassOrigin = { kind: 'user', name: 'bob', version: 'v3' };
    const snapshot: (name: string) => ClassUpdate = (name) => ({
      name: 'Notebook',
      methods: [{ name, overloads: [{ args: [] }] }],
      relations: [],
      
    });
    try {
      const repository: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
      await repository.updateClassSnapshots("mock-project", [snapshot('initial')], base);
      await Promise.all([
        repository.updateClassSnapshots("mock-project", [snapshot('aliceEdit')], alice),
        repository.updateClassSnapshots("mock-project", [snapshot('bobEdit')], bob),
      ]);
      const reference: FirebaseFirestore.DocumentReference = database.collection(`projects/mock-project/${collection}_snapshots`).doc('Notebook');
      const revisions: FirebaseFirestore.QuerySnapshot = await reference.collection('revisions').orderBy('ordinal').get();
      assert.equal(revisions.size, 3);
      assert.deepEqual(new Set(revisions.docs.map((item) => item.data().value.origin.name)), new Set(['scanner', 'alice', 'bob']));
      const history: Awaited<ReturnType<FirestoreClassRepository['getClassHistory']>> = await repository.getClassHistory("mock-project", ['Notebook']);
      assert.ok(history[0]?.methods.some((item) => item.name === 'aliceEdit'));
      assert.ok(history[0]?.methods.some((item) => item.name === 'bobEdit'));
      assert.equal(history[0]?.methods.filter((item) => item.status === 'active').length, 1);
    } finally {
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_snapshots`));
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_metadata`));
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_revision_ids`));
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_class_guids`));
      await database.terminate();
    }
  });
}
