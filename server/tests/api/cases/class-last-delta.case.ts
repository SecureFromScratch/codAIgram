import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import type { ClassChangeT, ClassOrigin, ClassUpdate } from '../../../dist/class-revision.js';
import { runWithServer } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'getClasses returns only the most recent batch of class changes',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/16 10:45', text: 'add a server api test - getClasses returns the change list of the LAST CHANGE only. this could be added/removed/modified classes, class name, members ("methods"), overloads, ... probably reuse the lastChange field and add fields to it.' },
    ],
  },
};

type ChangeResponseT = {
  lastChange: {
    origin: { kind: string; name: string; version: string };
    classes: { name: string; status: string; changes: ClassChangeT[] }[];
  };
};

export function registerClassLastDeltaCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base: string) => {
    const origin: ClassOrigin = { kind: 'scan', name: 'scanner', version: 'first' };
    const first: ClassUpdate = {
      name: 'Task',
      methods: [
        { 
          name: 'find', 
          overloads: [{ args: [{ arg: 'key', t: 'string' }] }, { args: [{ arg: 'id', t: 'number' }] }] 
        },
        { name: 'obsolete', overloads: [{ args: [] }] },
      ],
      relations: [{ kind: 'REF', name: 'owner', target: 'User', many: false }],
      
    };
    async function update(classes: unknown[], version: string): Promise<void> {
      const response: Response = await loggedFetch(`${base}/updateClasses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          origin: { kind: origin.kind, name: origin.name, version }, 
          classes 
        }),
      });
      assert.equal(response.status, 200);
    }
    await update([first], 'first');
    await update([{
      name: 'Task',
      methods: [
        { 
          name: 'find', 
          overloads: [{ 
            args: [{ arg: 'key', t: 'number' }], 
            modifies: 'key: string' 
        }, { args: [{ arg: 'active', t: 'boolean' }] }] 
        },
        { name: 'created', overloads: [{ args: [] }] },
      ],
      relations: [{ kind: 'REF', name: 'owner', target: 'Team', many: false }],
      
    }, { name: 'NewClass', methods: [], relations: [], }], 'second');
    const result: ChangeResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ChangeResponseT;
    assert.equal(result.lastChange.origin.version, 'second');
    assert.deepEqual(result.lastChange.classes.map((item) => [item.name, item.status]), [['Task', 'modified'], ['NewClass', 'added']]);
    const task: { name: string; status: string; changes: ClassChangeT[]; } | undefined = result.lastChange.classes[0];
    assert.ok(task);
    const find: ClassChangeT | undefined = task.changes.find((item) => item.kind === 'member' && item.after !== 'absent' && item.after.name === 'find');
    assert.ok(find && find.kind === 'member' && find.before !== 'absent' && find.after !== 'absent');
    assert.deepEqual(find.before.overloads.map((item) => item.args), [[{ arg: 'key', t: 'string' }], [{ arg: 'id', t: 'number' }]]);
    assert.deepEqual(find.after.overloads.map((item) => item.args), [[{ arg: 'key', t: 'number' }], [{ arg: 'active', t: 'boolean' }]]);
    assert.deepEqual(find.overloadRenames, [{ from: 'key: string', to: 'key: number' }]);
    assert.ok(task.changes.some((item) => item.kind === 'member' && item.before !== 'absent' && item.before.name === 'obsolete' && item.after === 'absent'));
    assert.ok(task.changes.some((item) => item.kind === 'member' && item.before === 'absent' && item.after !== 'absent' && item.after.name === 'created'));
    assert.ok(task.changes.some((item) => item.kind === 'relation' && item.before !== 'absent' && item.after !== 'absent' && item.before.target === 'User' && item.after.target === 'Team'));
    await update([{ name: 'NewClass', methods: [], relations: [], }], 'noop');
    const unchanged: ChangeResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ChangeResponseT;
    assert.deepEqual(unchanged.lastChange, result.lastChange);
    await update([{ name: 'Third', methods: [], relations: [], }], 'third');
    const latest: ChangeResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ChangeResponseT;
    assert.equal(latest.lastChange.origin.version, 'third');
    assert.deepEqual(latest.lastChange.classes.map((item) => [item.name, item.status]), [['Third', 'added']]);
  }));
}
