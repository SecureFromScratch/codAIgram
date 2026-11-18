import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { rebuildClassHistory, reviseClass } from '../../../dist/class-revision.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { parseStoredClassRevision, parseStoredClassSnapshot } from '../../../dist/class-storage-schema.js';
import type { ClassRevision, ClassUpdate } from '../../../dist/class-revision.js';
import { INITIAL, SCAN, USER } from '../support/class-revision-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "rejects malformed persisted snapshots and revisions instead of exposing their fields",
  prompt: {
    availability: 'available',
    old: "Track class changes and deletions under one originator per complete update.",
    history: [
      { when: "2026/11/15 09:35", text: "calling updateClasses is with a SINGLE originatoor type, name, version tag (usually a timestamp).\nall changes in that updated are attributed to them - including the deletion.\nin fact - a good storage structure will hold the current state in one document type and the history in another, where history only has the originators name etc once. this is a bit like git - current version on top and deltas going back" },
      { when: "2026/11/16 09:35", text: "fix that discarded logging info issue - change the logging to log all validation info available" },
    ],
  },
};

export function registerRevisionStorageValidationCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const created = reviseClass(INITIAL, undefined, SCAN, '2026-11-15T09:35:00Z');
    assert.deepEqual(parseStoredClassSnapshot(created.current), created.current);
    assert.throws(() => parseStoredClassSnapshot({
      name: 'Notebook',
      methods: [],
      relations: [],
      
      unexpectedSecret: 'must not leak',
    }), /invalid/);
    assert.throws(() => parseStoredClassRevision({
      origin: { kind: 'unknown', name: 'scanner', version: 'v1' },
      when: '2026-11-15T09:35:00Z',
      changes: [],
    }), /invalid/);
    assert.throws(() => parseStoredClassSnapshot({
      name: 'Notebook',
      methods: [],
      relations: [],
      isPartial: 'not-a-boolean',
      unexpectedSecret: 'must not leak',
    }, 'logging-validation-test'));
    const lines: string[] = readFileSync(path.resolve('logs/server.log'), 'utf8').trim().split('\n');
    const entries: { message?: string }[] = lines.map((line: string) => JSON.parse(line) as { message?: string });
    const entry: { message?: string } | undefined = entries.reverse().find((item: { message?: string }) => item.message?.includes('logging-validation-test'));
    assert.ok(entry?.message);
    const details: { documentId: string; issues: { path: (string | number)[]; code: string }[] } = JSON.parse(entry.message.slice('Storage validation failed: '.length));
    assert.equal(details.documentId, 'logging-validation-test');
    assert.ok(details.issues.some((issue) => issue.path.includes('isPartial') && issue.code === 'invalid_type'));
    assert.ok(details.issues.some((issue) => issue.code === 'unrecognized_keys'));
    assert.ok(!entry.message.includes('must not leak'));
  });
}
