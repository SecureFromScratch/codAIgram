import type { ClassDtoT } from "../support/class-history-support.js";
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { SCAN, classData, initial, runWithServer, update } from '../support/class-history-support.js';
import type { ClassHistoryT, CurrentClassDtoT } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "repeated identical updates retain the exact class and provenance",
  prompt: {
    availability: 'available',
    old: "Test idempotent class updates and per-member provenance history.",
    history: [
      { when: "2026/11/15 09:35", text: "add server tests for updateClasses and getClasses.\nif i update the same class twice with exact same data - i get back exact same data.\nin the tests - for each member field and relationship - supply who is the origin of the information: \"scan\",. \"ai\", \"user\" + their name (user will be supplied from loggedin user, scan uwill use os username, ai will identify it self - this is not the tests responsibility but it should mock data) + supply a \"version\" tag (this will be a timestamp or freetext string).\ngetClasses returns  for each member field and relationship who performed the last change and whem).\nanother test: perform multiple updateClasses, each time use different \"who\" and version tags, and different types of changes: add fields, remove fields, add overloads, remove overloads. an optional field for \"methods\" (fields) and \"relationships\" is \"modifies\" - sending this field means this is a modification of an existing field (\"method\") / relationship / overload. for fields/relationship it will pass their name. for overloads - the flattened text of the overload it modifies.\ngetClassesHistory returns structures similar to getClasses, but includes the history of each \"method\", relationship, overload (note that this means an overload is no longer simply an array - it has to become an interface/structure)" },
    ],
  },
};

export function registerClassIdempotenceCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base) => {
    const input: ClassDtoT = initial();
    await update(base, input, SCAN);
    const first: CurrentClassDtoT[] = (await (await loggedFetch(`${base}/getClasses`)).json() as { classes: CurrentClassDtoT[] }).classes;
    await update(base, input, SCAN);
    const second: CurrentClassDtoT[] = (await (await loggedFetch(`${base}/getClasses`)).json() as { classes: CurrentClassDtoT[] }).classes;
    assert.deepEqual(second, first);
    assert.deepEqual(second, [classData(input)]);
    const historyResponse: Response = await loggedFetch(`${base}/getClassesHistory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classNames: ['Notebook'] }),
    });
    assert.equal(historyResponse.status, 200);
    const history: ClassHistoryT[] = await historyResponse.json() as ClassHistoryT[];
    const notebook: ClassHistoryT | undefined = history[0];
    assert.ok(notebook);
    notebook.methods.forEach((member) => {
      assert.deepEqual(member.history.map((entry) => entry.origin), [SCAN]);
      assert.ok(member.history.every((entry) => !Number.isNaN(Date.parse(entry.when))));
    });
    notebook.relations.forEach((relation) => {
      assert.deepEqual(relation.history.map((entry) => entry.origin), [SCAN]);
      assert.ok(relation.history.every((entry) => !Number.isNaN(Date.parse(entry.when))));
    });
  }));
}
