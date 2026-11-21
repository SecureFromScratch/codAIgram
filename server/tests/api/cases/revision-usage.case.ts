import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { parseStoredClassRevision, parseStoredClassSnapshot } from '../../../dist/class-storage-schema.js';
import { reviseClass } from '../../../dist/class-revision.js';

export const TEST_CASE_METADATA = {
  title: 'records exception usage changes in class snapshots and revisions',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 23:42', text: 'add a test in scanner - classes that are thrown or used with logAndThrow are marked as usage: ex (add a server supported "usage" field to a class\'s details - modify server tests to check it is supported as well,' },
    ],
  },
};

export function registerRevisionUsageCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const origin = { kind: 'scan' as const, name: 'scanner', version: 'v1' };
    const initial = { name: 'Problem', methods: [], relations: [], };
    const marked = { name: 'Problem', methods: [], relations: [],  usage: 'ex' as const, sourceFile: 'src/problem.ts', modifiedAt: '2026-11-15T09:35:00.000Z' };
    const first = reviseClass(initial, undefined, origin, '2026-11-15T00:00:00Z');
    const second = reviseClass(marked, first.current, origin, '2026-11-15T00:00:01Z');
    assert.deepEqual(second.changes, [
      { kind: 'usage', before: 'none', after: 'ex' },
      { kind: 'source', before: { sourceFile: '', modifiedAt: '' }, after: { sourceFile: 'src/problem.ts', modifiedAt: '2026-11-15T09:35:00.000Z' } },
    ]);
    assert.equal(parseStoredClassSnapshot(second.current).usage, 'ex');
    assert.equal(parseStoredClassSnapshot(second.current).sourceFile, marked.sourceFile);
    assert.equal(parseStoredClassSnapshot(second.current).modifiedAt, marked.modifiedAt);
    assert.deepEqual(parseStoredClassRevision({ origin, when: '2026-11-15T00:00:01Z', changes: second.changes }).changes, second.changes);
    const repository = new MemoryClassRepository([]);
    await repository.updateClassSnapshots("mock-project", [initial], origin);
    await repository.updateClassSnapshots("mock-project", [marked], origin);
    assert.equal((await repository.getDetails("mock-project", ['Problem']))[0]?.usage, 'ex');
    assert.equal((await repository.getDetails("mock-project", ['Problem']))[0]?.sourceFile, marked.sourceFile);
    assert.equal((await repository.getClassHistory("mock-project", ['Problem']))[0]?.usage, 'ex');
    await repository.updateClassSnapshots("mock-project", [initial], origin);
    assert.equal((await repository.getDetails("mock-project", ['Problem']))[0]?.usage, undefined);
  });
}
