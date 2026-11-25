import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { AI, SCAN, USER, classData, initial, runWithServer, update } from '../support/class-history-support.js';
import type { ClassDtoT, ClassHistoryT } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "attributes deletion of every member and relationship to the update origin",
  prompt: {
    availability: 'available',
    old: "Test idempotent class updates and per-member provenance history.",
    history: [
      { when: "2026/11/15 09:35", text: "add server tests for updateClasses and getClasses.\nif i update the same class twice with exact same data - i get back exact same data.\nin the tests - for each member field and relationship - supply who is the origin of the information: \"scan\",. \"ai\", \"user\" + their name (user will be supplied from loggedin user, scan uwill use os username, ai will identify it self - this is not the tests responsibility but it should mock data) + supply a \"version\" tag (this will be a timestamp or freetext string).\ngetClasses returns  for each member field and relationship who performed the last change and whem).\nanother test: perform multiple updateClasses, each time use different \"who\" and version tags, and different types of changes: add fields, remove fields, add overloads, remove overloads. an optional field for \"methods\" (fields) and \"relationships\" is \"modifies\" - sending this field means this is a modification of an existing field (\"method\") / relationship / overload. for fields/relationship it will pass their name. for overloads - the flattened text of the overload it modifies.\ngetClassesHistory returns structures similar to getClasses, but includes the history of each \"method\", relationship, overload (note that this means an overload is no longer simply an array - it has to become an interface/structure)" },
    ],
  },
};

export function registerClassHistoryDeletionCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base) => {
    await update(base, initial(), SCAN);
    await update(base, { name: 'Notebook', methods: [], relations: [], }, { kind: 'user', name: 'alice', version: USER.version });
    const response: Response = await loggedFetch(`${base}/getClassesHistory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classNames: ['Notebook'] }),
    });
    assert.equal(response.status, 200);
    const classes: ClassHistoryT[] = await response.json() as ClassHistoryT[];
    const history: ClassHistoryT | undefined = classes[0];
    assert.ok(history);
    assert.ok(history.methods.every((item) => item.status === 'deleted' && item.history.at(-1)?.origin.name === 'yariv'));
    assert.ok(history.relations.every((item) => item.status === 'deleted' && item.history.at(-1)?.origin.name === 'yariv'));
    assert.ok(history.methods.flatMap((item) => item.overloads).every((item) => item.status === 'deleted' && item.history.at(-1)?.origin.name === 'yariv'));
  }));
}
