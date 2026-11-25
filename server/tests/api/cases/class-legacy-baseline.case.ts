import type { ClassHistory } from "../../../dist/class-revision.js";
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { runWithServer } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "records an explicitly unknown legacy baseline for an older class",
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

export function registerClassLegacyBaselineCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
      const repository: MemoryClassRepository = new MemoryClassRepository([{
        name: 'Old',
        methods: [{ 
          name: 'find', 
          overloads: [[{ arg: 'name', t: 'string' }]] 
        }],
        relations: [],
      }]);
      await repository.updateClassSnapshots("mock-project", [{
        name: 'New',
        renameOf: 'Old',
        methods: [{ 
          name: 'find', 
          overloads: [{ args: [{ arg: 'name', t: 'string' }] }] 
        }],
        relations: [],
      }], { kind: 'user', name: 'yariv', version: 'v1' });
      const history: ClassHistory[] = await repository.getClassHistory("mock-project", ['New']);
      assert.equal(history[0]?.methods[0]?.history[0]?.origin.kind, 'legacy');
      assert.equal(history[0]?.methods[0]?.history[0]?.origin.name, 'unknown');
      assert.deepEqual(history[0]?.renames.map((item) => [item.from, item.to]), [['Old', 'New']]);
      assert.deepEqual(await repository.getDetails("mock-project", ['Old']), []);
    });
}
