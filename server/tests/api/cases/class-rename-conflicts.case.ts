import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { runWithServer } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "rejects conflicting class renames and unknown deletions atomically",
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/16 10:45', text: 'updateClasses should support that a class update is a rename by having an optional field renameOf: <old class name>. this should enable tracing that class historically when going from present time backwards. for deletions - rename the isPartial field to an optional "state". it can be "partial", "deleted" or missing.' },
    ],
  },
};

type ChangeResponseT = {
  classes: { name: string; state?: 'partial' | 'deleted' }[];
  lastChange: { 
    classes: { name: string; status: string; renameOf?: string }[] 
  };
};

export function registerClassRenameConflictsCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base: string) => {
      async function send(classes: unknown[]): Promise<Response> {
        return loggedFetch(`${base}/updateClasses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            origin: { kind: 'scan', name: 'scanner', version: 'v1' }, 
            classes 
          }),
        });
      }
      assert.equal((await send([
        { name: 'First', methods: [], relations: [] },
        { name: 'Second', methods: [], relations: [] },
      ])).status, 200);
      const before: unknown = await (await loggedFetch(`${base}/getClasses`)).json();
      const invalidBatches: readonly unknown[][] = [
        [{ 
          name: 'Second', 
          renameOf: 'First', 
          methods: [], 
          relations: [] 
        }],
        [{ 
          name: 'Other', 
          renameOf: 'Missing', 
          methods: [], 
          relations: [] 
        }],
        [{ 
          name: 'Missing', 
          state: 'deleted', 
          methods: [], 
          relations: [] 
        }],
        [{ 
          name: 'Other', 
          renameOf: 'First', 
          methods: [], 
          relations: [] 
        }, { name: 'First', methods: [], relations: [] }],
      ];
      const checkInvalidBatch: (invalid: unknown[]) => Promise<void> = async (invalid: unknown[]) => {
        assert.equal((await send(invalid)).status, 400);
        assert.deepEqual(await (await loggedFetch(`${base}/getClasses`)).json(), before);
      };
      const invalidBatchChecks: Promise<void> = invalidBatches.reduce<Promise<void>>(
        async (previous: Promise<void>, invalid: unknown[]) => {
          await previous;
          await checkInvalidBatch(invalid);
        },
        Promise.resolve(),
      );
      await invalidBatchChecks;
    }));
}
