import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { INITIAL_TESTS, UPDATED_TESTS, post, withServer } from '../support/inventory-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "returns prompt and description change histories by group and name",
  prompt: {
    availability: 'available',
    old: "Verify inventory updates and the separate history API.",
    history: [
      { when: "2026/11/15 09:35", text: "add a test: when updateTests is called - existing tests remain and are not duplicated, new tests are added, updated tests are updated and the last change data can be viewed when performing getTests. getTests will NOT return the prompts.\nanother test makes sure that he change/history can be viewed whe nusing getHistory.\nget history will recieve a list of test identifiers (names?) and for each test returns: prompts history, test description change history.\nNOTE that you will need different dto then the actual storage type.\nDTO should use vv's new schema ux." },
    ],
  },
};

type HistoryEntryT = { when: string; text: string };
type HistoryResultT = {
  group: string;
  name: string;
  prompts: HistoryEntryT[];
  descriptions: HistoryEntryT[];
};

export function registerInventoryHistoryQueryCase(): void {
  test(TEST_CASE_METADATA.title, async () => withServer(async (base) => {
    assert.equal((await post(base, 'updateTests', INITIAL_TESTS)).status, 200);
    assert.equal((await post(base, 'updateTests', UPDATED_TESTS)).status, 200);
    assert.equal((await post(base, 'updateTests', UPDATED_TESTS)).status, 200);
    const response: Response = await post(base, 'getHistory', [{ group: 'model', name: 'edit' }]);
    assert.equal(response.status, 200);
    const result: HistoryResultT[] = await response.json() as HistoryResultT[];
    assert.equal(result.length, 1);
    assert.equal(result[0]?.group, 'model');
    assert.equal(result[0]?.name, 'edit');
    assert.deepEqual(result[0]?.prompts.map(item => item.text), ['first prompt', 'second prompt']);
    assert.deepEqual(result[0]?.descriptions.map(item => item.text), ['original', 'revised']);
    const entries: readonly HistoryEntryT[] = [...result[0]!.prompts, ...result[0]!.descriptions];
    entries.forEach((item: HistoryEntryT) => assert.ok(!Number.isNaN(Date.parse(item.when))));
  }));
}
