import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { runWithServer } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "accepts the optional partial state and validates state values",
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

export function registerClassStateValidationCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base: string) => {
      for (const [state, expected] of [['partial', 200], ['unknown', 400]] as const) {
        const response: Response = await loggedFetch(`${base}/updateClasses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { kind: 'scan', name: 'scanner', version: 'v1' },
            classes: [{ name: 'Example', methods: [], relations: [], state }],
          }),
        });
        assert.equal(response.status, expected);
      }
      const current: ChangeResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ChangeResponseT;
      assert.equal(current.classes[0]?.state, 'partial');
      assert.ok(current.classes.every((item) => !('isPartial' in item)));
      const historyResponse: Response = await loggedFetch(`${base}/getClassesHistory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: ['Example'] }),
      });
      const histories: { state?: string }[] = await historyResponse.json() as { state?: string }[];
      assert.equal(histories[0]?.state, 'partial');
      assert.ok(histories.every((item) => !('isPartial' in item)));
      const legacy: Response = await loggedFetch(`${base}/updateClasses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: { kind: 'scan', name: 'scanner', version: 'v2' }, classes: [{ name: 'Old', methods: [], relations: [], isPartial: true }] }),
      });
      assert.equal(legacy.status, 400);
    }));
}
