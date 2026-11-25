import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { INITIAL_TESTS, UPDATED_TESTS, post, withServer } from '../support/inventory-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "updates inventory without duplicates or prompt disclosure",
  prompt: {
    availability: 'available',
    old: "Verify inventory updates and the separate history API.",
    history: [
      { when: "2026/11/15 09:35", text: "add a test: when updateTests is called - existing tests remain and are not duplicated, new tests are added, updated tests are updated and the last change data can be viewed when performing getTests. getTests will NOT return the prompts.\nanother test makes sure that he change/history can be viewed whe nusing getHistory.\nget history will recieve a list of test identifiers (names?) and for each test returns: prompts history, test description change history.\nNOTE that you will need different dto then the actual storage type.\nDTO should use vv's new schema ux." },
    ],
  },
};

type TestInventoryEntryT = {
  group: string;
  name: string;
  description: string;
  lastChangedAt: string;
};

export function registerInventoryIdempotenceCase(): void {
  test(TEST_CASE_METADATA.title, async () => withServer(async (base) => {
    assert.equal((await post(base, 'updateTests', INITIAL_TESTS)).status, 200);
    assert.equal((await post(base, 'updateTests', UPDATED_TESTS)).status, 200);
    assert.equal((await post(base, 'updateTests', UPDATED_TESTS)).status, 200);
    const response: Response = await loggedFetch(`${base}/getTests`);
    assert.equal(response.status, 200);
    const entries: TestInventoryEntryT[] = await response.json() as TestInventoryEntryT[];
    assert.equal(entries.length, 3);
    assert.deepEqual(entries.map(x => [x.group, x.name, x.description]), [['model', 'keep', 'kept'], ['model', 'edit', 'revised'], ['model', 'new', 'new']]);
    entries.forEach((entry: TestInventoryEntryT) => {
      assert.ok(!('prompt' in entry));
      assert.ok(!Number.isNaN(Date.parse(entry.lastChangedAt)));
    });
  }));
}
