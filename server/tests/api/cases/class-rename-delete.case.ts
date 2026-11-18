import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { runWithServer } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'renames and deletes a class while retaining its history',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/16 10:45', text: 'updateClasses should support that a class update is a rename by having an optional field renameOf: <old class name>. this should enable tracing that class historically when going from present time backwards. for deletions - rename the isPartial field to an optional "state". it can be "partial", "deleted" or missing.' },
    ],
  },
};

type ChangeResponseT = {
  classes: { name: string; state?: 'partial' | 'deleted' }[];
  lastChange: { classes: { name: string; status: string; renameOf?: string }[] };
};

export function registerClassRenameDeleteCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base: string) => {
      async function update(value: unknown, version: string): Promise<void> {
        const response: Response = await loggedFetch(`${base}/updateClasses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin: { kind: 'scan', name: 'scanner', version }, classes: [value] }),
        });
        assert.equal(response.status, 200);
      }
      const methods = [{ name: 'find', overloads: [{ args: [{ arg: 'name', t: 'string' }] }] }];
      await update({ name: 'Original', methods, relations: [], state: 'partial' }, 'v1');
      await update({ name: 'Renamed', renameOf: 'Original', methods, relations: [] }, 'v2');
      let current: ChangeResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ChangeResponseT;
      assert.deepEqual(current.classes.map((item) => item.name), ['Renamed']);
      assert.equal(current.classes[0]?.state, undefined);
      assert.equal(current.lastChange.classes[0]?.renameOf, 'Original');
      await update({ name: 'Renamed', methods: [], relations: [], state: 'deleted' }, 'v3');
      current = await (await loggedFetch(`${base}/getClasses`)).json() as ChangeResponseT;
      assert.equal(current.classes[0]?.state, 'deleted');
      assert.equal(current.lastChange.classes[0]?.status, 'deleted');
      const response: Response = await loggedFetch(`${base}/getClassesHistory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: ['Renamed'] }),
      });
      assert.equal(response.status, 200);
      const history: { name: string; renames: { from: string; to: string; origin: { version: string } }[]; methods: { name: string; history: { origin: { version: string } }[] }[] }[] = await response.json() as { name: string; renames: { from: string; to: string; origin: { version: string } }[]; methods: { name: string; history: { origin: { version: string } }[] }[] }[];
      assert.equal(history[0]?.name, 'Renamed');
      assert.deepEqual(history[0]?.renames.map((item) => [item.from, item.to, item.origin.version]), [['Original', 'Renamed', 'v2']]);
      assert.deepEqual(history[0]?.methods.find((item) => item.name === 'find')?.history.map((item) => item.origin.version), ['v1', 'v3']);
    }));
}
