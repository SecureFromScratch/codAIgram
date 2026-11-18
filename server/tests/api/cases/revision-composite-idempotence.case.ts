import assert from 'node:assert/strict';
import { it } from 'node:test';
import { JsonMap } from '@codaigram/shared/json-map';
import type { CompositeTypeT } from '@codaigram/shared/class-types';
import { reviseClass } from '../../../dist/class-revision.js';
import type { ClassUpdate, RevisionResult } from '../../../dist/class-revision.js';
import { createInitialRevision, SCAN, USER } from '../support/class-revision-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'ignores composite field key order when detecting unchanged overloads',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 09:35', text: 'if i update the same class twice with exact same data - i get back exact same data.' },
    ],
  },
};

export function registerRevisionCompositeIdempotenceCase(): void {
  it(TEST_CASE_METADATA.title, () => {
    const firstType: JsonMap<string, CompositeTypeT> = new JsonMap<string, CompositeTypeT>([['first', 'string'], ['second', 'number']]);
    const reorderedType: JsonMap<string, CompositeTypeT> = new JsonMap<string, CompositeTypeT>([['second', 'number'], ['first', 'string']]);
    const first: ClassUpdate = {
      name: 'Notebook',
      methods: [{ name: 'settings', overloads: [{ args: [{ arg: '+RO', t: firstType }] }] }],
      relations: [],
      
    };
    const second: ClassUpdate = {
      name: 'Notebook',
      methods: [{ name: 'settings', overloads: [{ args: [{ arg: '+RO', t: reorderedType }] }] }],
      relations: [],
      
    };
    const created: RevisionResult = createInitialRevision(first, SCAN);
    const repeated: RevisionResult = reviseClass(second, created.current, USER);
    assert.deepEqual(repeated.changes, []);
    assert.deepEqual(repeated.current, created.current);
    assert.equal(JSON.stringify(repeated.current), JSON.stringify(created.current));
  });
}
