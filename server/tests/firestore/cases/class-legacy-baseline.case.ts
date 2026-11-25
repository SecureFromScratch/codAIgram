import type { TestCaseMetadata } from "../../test-case-metadata.js";
import type { ClassHistory } from "../../../dist/class-revision.js";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createLocalFirestore, FirestoreClassRepository } from '../../../dist/firestore-repository.js';
import { createApp } from '../../../dist/app.js';
import type { ClassOrigin, ClassUpdate } from '../../../dist/class-revision.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "records an unknown-provenance baseline when renaming or deleting legacy-only classes",
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/16 12:45', text: 'implement rename/deletion functionality in server' },
      { when: '2026/11/16 10:45', text: 'updateClasses should support that a class update is a rename by having an optional field renameOf: <old class name>. this should enable tracing that class historically when going from present time backwards. for deletions - rename the isPartial field to an optional "state". it can be "partial", "deleted" or missing.' },
    ],
  },
};

export function registerClassLegacyBaselineCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
      const database: FirebaseFirestore.Firestore = createLocalFirestore();
      const collection: string = `legacy_rename_${randomUUID().replaceAll('-', '')}`;
      const origin: ClassOrigin = { kind: 'user', name: 'yariv', version: 'v1' };
      try {
        const ids: Map<string, string> = new Map([
          ['Original', '123e4567-e89b-42d3-a456-426614174000'],
          ['Obsolete', '123e4567-e89b-42d3-a456-426614174001'],
        ]);
        const legacyNames: readonly string[] = ['Original', 'Obsolete'];
        const saveLegacyClass: (name: string) => Promise<void> = async (name: string) => {
          const nonCryptoGuid: string | undefined = ids.get(name);
          assert.ok(nonCryptoGuid);
          await database.collection(`projects/mock-project/${collection}`).doc(name).set({
            name,
            methods: [{ 
              name: 'find', 
              overloads: [{ args: [{ arg: 'name', t: 'string' }] }] 
            }],
            relations: [],
            nonCryptoGuid,
          });
          await database.collection(`projects/mock-project/${collection}_class_guids`).doc(nonCryptoGuid).set({ allocated: true });
        };
        const saveLegacyClasses: Promise<void>[] = legacyNames.map(saveLegacyClass);
        await Promise.all(saveLegacyClasses);
        const repository: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
        await repository.updateClassSnapshots("mock-project", [{
          name: 'Renamed',
          renameOf: 'Original',
          methods: [{ 
            name: 'find', 
            overloads: [{ args: [{ arg: 'name', t: 'string' }] }] 
          }],
          relations: [],
        }], origin);
        await repository.updateClassSnapshots("mock-project", [{ 
          name: 'Obsolete', 
          state: 'deleted', 
          methods: [], 
          relations: [] 
        }], origin);
        const reopened: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
        assert.deepEqual((await reopened.getClasses("mock-project")).map((item) => item.name), ['Obsolete']);
        assert.deepEqual((await reopened.getClassSnapshots("mock-project")).map((item) => item.name), ['Obsolete', 'Renamed']);
        assert.equal((await reopened.getClassSnapshots("mock-project")).find((item) => item.name === 'Renamed')?.nonCryptoGuid, ids.get('Original'));
        assert.equal((await reopened.getClassSnapshots("mock-project")).find((item) => item.name === 'Obsolete')?.nonCryptoGuid, ids.get('Obsolete'));
        const history: ClassHistory[] = await reopened.getClassHistory("mock-project", ['Renamed', 'Obsolete']);
        assert.equal(history[0]?.methods[0]?.history[0]?.origin.kind, 'legacy');
        assert.equal(history[0]?.methods[0]?.history[0]?.origin.name, 'unknown');
        assert.deepEqual(history[0]?.renames.map((item) => [item.from, item.to]), [['Original', 'Renamed']]);
        assert.equal(history[1]?.methods[0]?.status, 'deleted');
        assert.deepEqual(history[1]?.methods[0]?.history.map((item) => item.origin.kind), ['legacy', 'user']);
      } finally {
        await database.recursiveDelete(database.collection(`projects/mock-project/${collection}`));
        await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_snapshots`));
        await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_metadata`));
        await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_revision_ids`));
        await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_class_guids`));
        await database.terminate();
      }
    });
}
