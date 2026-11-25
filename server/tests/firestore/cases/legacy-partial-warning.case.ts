import type { TestCaseMetadata } from "../../test-case-metadata.js";
import type { ClassDetails } from "../../../../shared/dist/class-types.js";
import type { CurrentClass } from "../../../dist/class-revision.js";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createLocalFirestore, FirestoreClassRepository } from '../../../dist/firestore-repository.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
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
      await database.collection(`projects/mock-project/${collection}`).doc(legacyName).set({
        name: legacyName,
        methods: [],
        relations: [],
        isPartial: false,
      });
      await database.collection(`projects/mock-project/${collection}_snapshots`).doc(snapshotName).set({
        value: { 
          name: snapshotName, 
          methods: [], 
          relations: [], 
          isPartial: true 
        },
        revisionCount: 1,
      });
      const repository: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
      const legacy: ClassDetails[] = await repository.getClasses("mock-project");
      const snapshots: CurrentClass[] = await repository.getClassSnapshots("mock-project");
      assert.equal(legacy[0] && 'state' in legacy[0], false);
      assert.equal(snapshots[0]?.state, 'partial');
      const lines: string[] = readFileSync(path.resolve('logs/server.log'), 'utf8').trim().split('\n');
      const entries: { level: string; message: string }[] = lines.map((line: string) => JSON.parse(line) as { level: string; message: string });
      const warnedNames: readonly string[] = [legacyName, snapshotName];
      warnedNames.forEach((name: string) => {
        assert.ok(entries.some((entry) => entry.level === 'WARN' && entry.message.includes('Legacy isPartial field') && entry.message.includes(name)));
      });
    } finally {
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}`));
      await database.recursiveDelete(database.collection(`projects/mock-project/${collection}_snapshots`));
      await database.terminate();
    }
  });
}
