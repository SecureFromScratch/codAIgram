import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { runWithServer } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'refreshes a scanned file timestamp without creating a class change',
  prompt: {
    availability: 'available',
    history: [{
      when: '2026/11/17 09:35',
      text: 'updateClasses marks interfaces/classes as changed even if they did not and the only change is to their file timestamp. add a server api test - updateClasses + getClasses. make sure that sending an UNCHANGED class except for the timestamp of its file is not considered a change and not returned as a change. also add tests to existing tests using getClasses - getClasses and getClassesHistory to NOT report on a change that is only to the timestamp of a file. the goal of using file-timestamp is to be able to later create a "git status" like behaviour - so the timestamp should be updated but not considered a change.'
    }],
  },
};

type ClassesResponseT = {
  classes: {
    name: string;
    modifiedAt?: string;
  }[];
  lastChange?: {
    origin: {
      version: string;
    };
  };
};

export function registerFileTimestampCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base: string) => {
    async function update(version: string, modifiedAt: string): Promise<void> {
      const response: Response = await loggedFetch(`${base}/updateClasses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: {
            kind: 'scan',
            name: 'scanner',
            version,
          },
          classes: [{
            name: 'ScannedClass',
            sourceFile: 'src/scanned-class.ts',
            modifiedAt,
            methods: [{
              name: 'run',
              overloads: [{ args: [] }],
            }],
            relations: [],
          }],
        }),
      });
      assert.equal(response.status, 200);
    }

    await update('first', '2026-11-17T09:30:00.000Z');
    const first: ClassesResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ClassesResponseT;
    assert.equal(first.lastChange?.origin.version, 'first');
    await update('timestamp-only', '2026-11-17T09:31:00.000Z');
    const afterTimestamp: ClassesResponseT = await (await loggedFetch(`${base}/getClasses`)).json() as ClassesResponseT;
    assert.equal(afterTimestamp.classes[0]?.modifiedAt, '2026-11-17T09:31:00.000Z');
    assert.deepEqual(afterTimestamp.lastChange, first.lastChange);
    const historyResponse: Response = await loggedFetch(`${base}/getClassesHistory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classNames: ['ScannedClass'] }),
    });
    assert.equal(historyResponse.status, 200);
    const history: { methods: { history: unknown[] }[] }[] = await historyResponse.json() as { methods: { history: unknown[] }[] }[];
    assert.equal(history[0]?.methods[0]?.history.length, 1);
    const revisionsResponse: Response = await loggedFetch(`${base}/getRevisionIds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ howFarBack: 1 }),
    });
    assert.equal(revisionsResponse.status, 200);
    assert.deepEqual(await revisionsResponse.json(), ['first']);
  }));
}
