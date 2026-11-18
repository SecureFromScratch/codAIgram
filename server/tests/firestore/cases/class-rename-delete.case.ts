import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createLocalFirestore, FirestoreClassRepository } from '../../../dist/firestore-repository.js';
import { createApp } from '../../../dist/app.js';
import { loggedFetch } from '../../../dist/server_utils.js';
import type { ClassOrigin, ClassUpdate } from '../../../dist/class-revision.js';

export const TEST_CASE_METADATA = {
  title: 'preserves class identity and history through Firestore renames and deletion',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/16 12:45', text: 'implement rename/deletion functionality in server' },
      { when: '2026/11/16 10:45', text: 'updateClasses should support that a class update is a rename by having an optional field renameOf: <old class name>. this should enable tracing that class historically when going from present time backwards. for deletions - rename the isPartial field to an optional "state". it can be "partial", "deleted" or missing.' },
    ],
  },
};

export function registerClassRenameDeleteCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
      const database: FirebaseFirestore.Firestore = createLocalFirestore();
      const collection: string = `rename_test_${randomUUID().replaceAll('-', '')}`;
      const origin: ClassOrigin = { kind: 'scan', name: 'scanner', version: 'v1' };
      const first: ClassUpdate = {
        name: 'Original',
        state: 'partial',
        methods: [{ name: 'find', overloads: [{ args: [{ arg: 'name', t: 'string' }] }] }],
        relations: [],
      };
      try {
        const repository: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
        await repository.updateClassSnapshots([first], origin);
        const id: string | undefined = (await repository.getClassSnapshots())[0]?.nonCryptoGuid;
        assert.ok(id);
        await repository.updateClassSnapshots([{
          name: 'Renamed',
          renameOf: 'Original',
          methods: first.methods,
          relations: [],
        }], { kind: 'ai', name: 'model', version: 'v2' });
        assert.equal((await repository.getLastClassChange())?.classes?.[0]?.renameOf, 'Original');
        await repository.updateClassSnapshots([{
          name: 'Final',
          renameOf: 'Renamed',
          methods: first.methods,
          relations: [],
        }], { kind: 'scan', name: 'scanner', version: 'v3' });
        const reopened: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
        assert.deepEqual((await reopened.getClassSnapshots()).map((item) => item.name), ['Final']);
        assert.equal((await reopened.getClassSnapshots())[0]?.nonCryptoGuid, id);
        assert.deepEqual(await reopened.getDetails(['Original', 'Renamed']), []);
        const history = await reopened.getClassHistory(['Final']);
        assert.deepEqual(history[0]?.renames.map((item) => [item.from, item.to]), [['Original', 'Renamed'], ['Renamed', 'Final']]);
        assert.equal(history[0]?.methods[0]?.history[0]?.origin.version, 'v1');
        const before = await reopened.getLastClassChange();
        await assert.rejects(reopened.updateClassSnapshots([{ name: 'Original', methods: [], relations: [] }], origin));
        await assert.rejects(reopened.updateClassSnapshots([{ name: 'Missing', renameOf: 'Unknown', methods: [], relations: [] }], origin));
        assert.deepEqual(await reopened.getLastClassChange(), before);
        await reopened.updateClassSnapshots([{ name: 'Final', state: 'deleted', methods: [], relations: [] }], { kind: 'scan', name: 'scanner', version: 'v4' });
        assert.equal((await reopened.getClassSnapshots())[0]?.state, 'deleted');
        assert.equal((await reopened.getClassHistory(['Final']))[0]?.methods[0]?.status, 'deleted');
        assert.equal((await reopened.getLastClassChange())?.classes?.[0]?.status, 'deleted');
        const server: ReturnType<ReturnType<typeof createApp>['listen']> = createApp(reopened).listen(0, '127.0.0.1');
        try {
          await new Promise<void>((resolve) => server.once('listening', resolve));
          const address: ReturnType<typeof server.address> = server.address();
          assert.ok(address && typeof address !== 'string');
        const response: Response = await loggedFetch(`http://127.0.0.1:${address.port}/api/getClasses`);
          assert.equal(response.status, 200);
          const body: { classes: { name: string; state?: string }[]; lastChange: { classes: { status: string }[] } } = await response.json() as { classes: { name: string; state?: string }[]; lastChange: { classes: { status: string }[] } };
          assert.deepEqual(body.classes.map((item) => [item.name, item.state]), [['Final', 'deleted']]);
          assert.equal(body.lastChange.classes[0]?.status, 'deleted');
        } finally {
          await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve()));
        }
      } finally {
        await database.recursiveDelete(database.collection(`${collection}_snapshots`));
        await database.recursiveDelete(database.collection(`${collection}_metadata`));
        await database.recursiveDelete(database.collection(`${collection}_revision_ids`));
        await database.recursiveDelete(database.collection(`${collection}_class_guids`));
        await database.terminate();
      }
    });
}
