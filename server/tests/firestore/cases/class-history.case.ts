import type { TestCaseMetadata } from "../../test-case-metadata.js";
import type { DatabaseClassChange } from "../../../dist/memory-repository.js";
import type { CurrentClass, ClassHistory } from "../../../dist/class-revision.js";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createLocalFirestore, FirestoreClassRepository } from '../../../dist/firestore-repository.js';
import type { ClassOrigin, ClassUpdate } from '../../../dist/class-revision.js';
import { ERROR_CODES } from '../../../dist/error-codes.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'persists class snapshots and separately stored revision deltas',
  prompt: {
    availability: 'available',
    old: 'Verify Firestore class history remains available after repository recreation.',
    history: [
      { when: '2026/11/15 09:35', text: 'calling updateClasses is with a SINGLE originatoor type, name, version tag (usually a timestamp).\nall changes in that updated are attributed to them - including the deletion.\nin fact - a good storage structure will hold the current state in one document type and the history in another, where history only has the originators name etc once. this is a bit like git - current version on top and deltas going back' },
      { when: '2026/11/16 09:35', text: 'add a server api test: getClasses returns correct LAST CHANGE originator, versiontag, actual change time on server (added by server in updateClasses or metadata from firestore (if available). LAST CHANGE here means actual whole database last change - not per class.' },
      { when: '2026/11/16 10:45', text: 'internally, in storage, assign each new class a unique id (guid, no need for cryptographically random - use fastest guid version generation avaiable, but comment that it is NOT cryptosafe, in fact - its field should have the words nonCryptoGuid). for historical revisions add the id field as well.' },
      { when: '2026/11/17 09:35', text: 'updateClasses marks interfaces/classes as changed even if they did not and the only change is to their file timestamp. The timestamp should be updated for future git-status-like behaviour, but must not create a class change or history entry.' },
    ],
  },
};

export function registerClassHistoryCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const database: FirebaseFirestore.Firestore = createLocalFirestore();
    const collection: string = `codaigram_revision_test_${randomUUID().replaceAll('-', '')}`;
    const scan: ClassOrigin = { kind: 'scan', name: 'test-scanner', version: 'v1' };
    const user: ClassOrigin = { kind: 'user', name: 'test-user', version: 'v2' };
    const initial: ClassUpdate = {
      name: 'Notebook',
      methods: [{
        name: 'find',
        overloads: [{ args: [{ arg: 'key', t: 'string' }] }]
      }],
      relations: [{ kind: 'OWNS', name: 'pages', target: 'Page', many: true }],
      state: 'partial',
      sourceFile: 'src/notebook.ts',
      modifiedAt: '2026-11-17T09:30:00.000Z',
    };
    try {
      const legacyGuid: string = '123e4567-e89b-42d3-a456-426614174000';
      await database.collection(`projects/mock-project/${collection}`).doc('Notebook').set({
        name: 'Notebook',
        methods: [],
        relations: [],
        nonCryptoGuid: legacyGuid,
      });
      await database.collection(`projects/mock-project/${collection}_class_guids`).doc(legacyGuid).set({ allocated: true });
      const repository: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
      await repository.updateClassSnapshots("mock-project", [initial], scan);
      const storedPartial: FirebaseFirestore.DocumentData | undefined = (await database.collection(`projects/mock-project/${collection}_snapshots`).doc('Notebook').get()).data();
      assert.equal(storedPartial?.value.state, 'partial');
      assert.ok(!('isPartial' in storedPartial!.value));
      assert.equal((await repository.getClassSnapshots("mock-project"))[0]?.state, 'partial');
      const timestampLastChange: DatabaseClassChange | undefined = await repository.getLastClassChange("mock-project");
      const timestampRevisionCount: number = storedPartial!.revisionCount as number;
      const timestampOnlyUpdate: ClassUpdate = {
        name: initial.name,
        methods: initial.methods,
        relations: initial.relations,
        state: 'partial',
        sourceFile: 'src/notebook.ts',
        modifiedAt: '2026-11-17T09:31:00.000Z',
      };
      await repository.updateClassSnapshots("mock-project", [timestampOnlyUpdate], user);
      const refreshedSnapshot: FirebaseFirestore.DocumentData | undefined = (await database.collection(`projects/mock-project/${collection}_snapshots`).doc('Notebook').get()).data();
      assert.equal(refreshedSnapshot?.value.modifiedAt, '2026-11-17T09:31:00.000Z');
      assert.equal(refreshedSnapshot?.revisionCount, timestampRevisionCount);
      assert.deepEqual(await repository.getLastClassChange("mock-project"), timestampLastChange);
      await repository.updateClassSnapshots("mock-project", [initial], user);
      const before: number = Date.now();
      await repository.updateClassSnapshots("mock-project", [{ name: 'Notebook', methods: [], relations: [], }], user);
      const after: number = Date.now();
      const reopened: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
      const lastChange: DatabaseClassChange | undefined = await reopened.getLastClassChange("mock-project");
      assert.ok(lastChange);
      assert.deepEqual(lastChange.origin, user);
      assert.deepEqual(lastChange.classes?.map((item) => [item.name, item.status]), [['Notebook', 'modified']]);
      assert.ok(lastChange.classes?.[0]?.changes.some((change) => change.kind === 'member' && change.after === 'absent'));
      assert.ok(lastChange.classes?.[0]?.changes.some((change) => change.kind === 'relation' && change.after === 'absent'));
      assert.ok(Date.parse(lastChange.changedAt) >= before && Date.parse(lastChange.changedAt) <= after);
      const current: CurrentClass[] = await reopened.getClassSnapshots("mock-project");
      assert.equal(current.length, 1);
      assert.deepEqual(current[0]?.methods, []);
      assert.deepEqual(current[0]?.relations, []);
      const history: ClassHistory[] = await reopened.getClassHistory("mock-project", ['Notebook']);
      assert.equal(history[0]?.methods[0]?.status, 'deleted');
      assert.equal(history[0]?.relations[0]?.status, 'deleted');
      assert.deepEqual(history[0]?.methods[0]?.history.map((item) => item.origin.name), ['test-scanner', 'test-user']);
      assert.ok(history[0]?.methods[0]?.history.every((item) => !Number.isNaN(Date.parse(item.when))));
      const revisions: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData> = await database.collection(`projects/mock-project/${collection}_snapshots`).doc('Notebook').collection('revisions').get();
      assert.equal(revisions.size, 2);
      const guid: string | undefined = current[0]?.nonCryptoGuid;
      assert.ok(guid);
      assert.equal(guid, legacyGuid);
      assert.match(guid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.ok(revisions.docs.every((item) => item.data().value.nonCryptoGuid === guid));
      await repository.updateClassSnapshots("mock-project", [{ name: 'Other', methods: [], relations: [], }], scan);
      const classes: CurrentClass[] = await reopened.getClassSnapshots("mock-project");
      assert.equal(classes.find((item) => item.name === 'Notebook')?.nonCryptoGuid, guid);
      assert.notEqual(classes.find((item) => item.name === 'Other')?.nonCryptoGuid, guid);
      const snapshotReference: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData> = database.collection(`projects/mock-project/${collection}_snapshots`).doc('Notebook');
      await snapshotReference.update({ revisionCount: 3 });
      await assert.rejects(reopened.getClassHistory("mock-project", ['Notebook']), { code: ERROR_CODES.CLASS_HISTORY_INCOMPLETE });
      await snapshotReference.update({ revisionCount: 2 });
      const revisionReference: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData> = snapshotReference.collection('revisions').doc('000000000001');
      await revisionReference.update({
        value: {
          origin: scan,
          when: '2026-11-15T09:35:00Z',
          changes: [],
          unexpectedSecret: 'not a response field'
        },
      });
      await assert.rejects(reopened.getClassHistory("mock-project", ['Notebook']), { code: ERROR_CODES.CLASS_REVISION_INVALID });
    } finally {
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_snapshots`));
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_metadata`));
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_revision_ids`));
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_class_guids`));
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}`));
      await database.terminate();
    }
  });
}
