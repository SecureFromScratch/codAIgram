import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { AI, SCAN, initial, runWithServer, update } from '../support/class-history-support.js';
import type { ClassDtoT, OriginT } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'getClasses reports the latest class change within its project',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/16 09:35', text: 'add a server api test: getClasses returns correct LAST CHANGE originator, versiontag, actual change time on server (added by server in updateClasses or metadata from firestore (if available). LAST CHANGE here means actual whole database last change - not per class.' },
    ],
  },
};

type ClassesResponseT = {
  classes: ClassDtoT[];
  lastChange?: { origin: OriginT; changedAt: string };
};

export function registerClassGlobalLastChangeCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base: string) => {
    const empty: ClassesResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ClassesResponseT;
    assert.deepEqual(empty.classes, []);
    assert.ok(!('lastChange' in empty));
    const first: ClassDtoT = initial();
    await update(base, first, SCAN);
    const before: number = Date.now();
    const second: ClassDtoT = { name: 'Other', methods: [], relations: [], };
    await update(base, second, AI);
    const after: number = Date.now();
    const result: ClassesResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ClassesResponseT;
    assert.deepEqual(result.classes.map((item: ClassDtoT) => item.name), ['Notebook', 'Other']);
    assert.ok(result.classes.every((item: ClassDtoT) => !('nonCryptoGuid' in item)));
    assert.ok(result.lastChange);
    assert.deepEqual(result.lastChange.origin, AI);
    const changedAt: number = Date.parse(result.lastChange.changedAt);
    assert.ok(changedAt >= before && changedAt <= after);
    await update(base, second, SCAN);
    const unchanged: ClassesResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ClassesResponseT;
    assert.deepEqual(unchanged.lastChange, result.lastChange);
    const testsUpdate: Response = await loggedFetch(`${base}/updateTests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ 
        group: 'sample', 
        name: 'test', 
        description: 'A test', 
        prompt: 'Test it' 
      }]),
    });
    assert.equal(testsUpdate.status, 200);
    const afterTests: ClassesResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ClassesResponseT;
    assert.deepEqual(afterTests.lastChange, result.lastChange);
  }));
}
