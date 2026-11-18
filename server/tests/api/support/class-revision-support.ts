import assert from 'node:assert/strict';
import { rebuildClassHistory, reviseClass } from '../../../dist/class-revision.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { parseStoredClassRevision, parseStoredClassSnapshot } from '../../../dist/class-storage-schema.js';
import type { ClassOrigin, ClassRevision, ClassUpdate, RevisionResult } from '../../../dist/class-revision.js';

export const SCAN: ClassOrigin = { kind: 'scan', name: 'scanner', version: 'v1' };
export const USER: ClassOrigin = { kind: 'user', name: 'alice', version: 'v2' };
export const INITIAL: ClassUpdate = {
  name: 'Notebook',
  methods: [{
    name: 'find',
    overloads: [{ args: [{ arg: 'key', t: 'string' }] }]
  }],
  relations: [{ kind: 'OWNS', name: 'pages', target: 'Page', many: true }],
  
};

export function createInitialRevision(update: ClassUpdate, origin: ClassOrigin, when: string = new Date().toISOString()): RevisionResult {
  // UNTRUST-ALLOW-NULLISH: A newly introduced class has no previous snapshot; this test helper supplies that explicit absence at the revision boundary without inventing a prior class.
  return reviseClass(update, undefined, origin, when);
}

