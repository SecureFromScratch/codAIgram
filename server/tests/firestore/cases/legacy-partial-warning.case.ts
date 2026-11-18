import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createLocalFirestore, FirestoreClassRepository } from '../../../dist/firestore-repository.js';

export const TEST_CASE_METADATA = {
  title: 'warns when legacy class documents and snapshots contain isPartial',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/16 12:18', text: 'log any case where the isPartial still exists as a log warning. these should have been converted.' },
    ],
  },
};

export function registerLegacyPartialWarningCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const database: FirebaseFirestore.Firestore = createLocalFirestore();
    const suffix: string = randomUUID().replaceAll('-', '');
    const collection: string = `legacy_warning_${suffix}`;
    const legacyName: string = `Legacy_${suffix}`;
    const snapshotName: string = `Snapshot_${suffix}`;
    try {
      await database.collection(collection).doc(legacyName).set({
        name: legacyName,
        methods: [],
        relations: [],
        isPartial: false,
      });
      await database.collection(`${collection}_snapshots`).doc(snapshotName).set({
        value: { name: snapshotName, methods: [], relations: [], isPartial: true },
        revisionCount: 1,
      });
      const repository: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
      const legacy = await repository.getClasses();
      const snapshots = await repository.getClassSnapshots();
      assert.equal(legacy[0]?.state, undefined);
      assert.equal(snapshots[0]?.state, 'partial');
      const lines: string[] = readFileSync(path.resolve('logs/server.log'), 'utf8').trim().split('\n');
      const entries: { level: string; message: string }[] = lines.map((line: string) => JSON.parse(line) as { level: string; message: string });
      for (const name of [legacyName, snapshotName]) {
        assert.ok(entries.some((entry) => entry.level === 'WARN' && entry.message.includes('Legacy isPartial field') && entry.message.includes(name)));
      }
    } finally {
      await database.recursiveDelete(database.collection(collection));
      await database.recursiveDelete(database.collection(`${collection}_snapshots`));
      await database.terminate();
    }
  });
}
