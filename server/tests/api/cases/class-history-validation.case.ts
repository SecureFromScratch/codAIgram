import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { AI, SCAN, USER, classData, initial, runWithServer, update } from '../support/class-history-support.js';
import type { ClassDtoT, ClassHistoryT } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "rejects missing origin, duplicate classes and invalid modifications without partially updating data",
  prompt: {
    availability: 'available',
    old: "Test idempotent class updates and per-member provenance history.",
    history: [
      { when: "2026/11/15 09:35", text: "add server tests for updateClasses and getClasses.\nif i update the same class twice with exact same data - i get back exact same data.\nin the tests - for each member field and relationship - supply who is the origin of the information: \"scan\",. \"ai\", \"user\" + their name (user will be supplied from loggedin user, scan uwill use os username, ai will identify it self - this is not the tests responsibility but it should mock data) + supply a \"version\" tag (this will be a timestamp or freetext string).\ngetClasses returns  for each member field and relationship who performed the last change and whem).\nanother test: perform multiple updateClasses, each time use different \"who\" and version tags, and different types of changes: add fields, remove fields, add overloads, remove overloads. an optional field for \"methods\" (fields) and \"relationships\" is \"modifies\" - sending this field means this is a modification of an existing field (\"method\") / relationship / overload. for fields/relationship it will pass their name. for overloads - the flattened text of the overload it modifies.\ngetClassesHistory returns structures similar to getClasses, but includes the history of each \"method\", relationship, overload (note that this means an overload is no longer simply an array - it has to become an interface/structure)" },
    ],
  },
};

export function registerClassHistoryValidationCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base) => {
    await update(base, initial(), SCAN);
    const before: unknown = await (await loggedFetch(`${base}/getClasses`)).json();
    const invalidBatches: unknown[] = [
      { classes: [] },
      {
        origin: { kind: 'unknown', name: 'tester', version: 'v1' },
        classes: []
      },
      {
        origin: USER,
        classes: [{
          name: 'Notebook',
          methods: [],
          relations: [],
          }, {
          name: 'Notebook',
          methods: [],
          relations: [],
          }]
      },
      {
        origin: USER,
        classes: [{
          name: 'NewClass',
          methods: [],
          relations: [],
          }, {
          name: 'Notebook',
          methods: [{ name: 'search', modifies: 'missing', overloads: [] }],
          relations: [],
          }]
      },
    ];
    for (const body of invalidBatches) {
      const response = await loggedFetch(`${base}/updateClasses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await (await loggedFetch(`${base}/getClasses`)).json(), before);
    }
  }));
}
