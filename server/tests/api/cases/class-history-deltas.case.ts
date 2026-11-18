import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loggedFetch } from '../../../dist/server_utils.js';
import { AI, SCAN, USER, classData, initial, runWithServer, update } from '../support/class-history-support.js';
import type { ClassDtoT, ClassHistoryT, CurrentClassDtoT } from '../support/class-history-support.js';
import type { TestCaseMetadata } from '../../test-case-metadata.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "retains member, relation and overload histories across additions, removals and replacements",
  prompt: {
    availability: 'available',
    old: "Test idempotent class updates and per-member provenance history.",
    history: [
      { when: "2026/11/15 09:35", text: "add server tests for updateClasses and getClasses.\nif i update the same class twice with exact same data - i get back exact same data.\nin the tests - for each member field and relationship - supply who is the origin of the information: \"scan\",. \"ai\", \"user\" + their name (user will be supplied from loggedin user, scan uwill use os username, ai will identify it self - this is not the tests responsibility but it should mock data) + supply a \"version\" tag (this will be a timestamp or freetext string).\ngetClasses returns  for each member field and relationship who performed the last change and whem).\nanother test: perform multiple updateClasses, each time use different \"who\" and version tags, and different types of changes: add fields, remove fields, add overloads, remove overloads. an optional field for \"methods\" (fields) and \"relationships\" is \"modifies\" - sending this field means this is a modification of an existing field (\"method\") / relationship / overload. for fields/relationship it will pass their name. for overloads - the flattened text of the overload it modifies.\ngetClassesHistory returns structures similar to getClasses, but includes the history of each \"method\", relationship, overload (note that this means an overload is no longer simply an array - it has to become an interface/structure)" },
    ],
  },
};

export function registerClassHistoryDeltasCase(): void {
  test(TEST_CASE_METADATA.title, async () => runWithServer(async (base) => {
    await update(base, initial(), SCAN);
    const second: ClassDtoT = {
      name: 'Notebook',
      methods: [
        {
          name: 'heading',
          modifies: 'title',
          origin: AI,
          overloads: [{
            args: [{ arg: '+RW', t: 'string' }],
            origin: AI,
            modifies: '+RO: string'
          }]
        },
        {
          name: 'find',
          origin: AI,
          overloads: [{ args: [{ arg: 'name', t: 'string' }], origin: SCAN }, { args: [{ arg: 'index', t: 'number' }], origin: AI }]
        },
        {
          name: 'size',
          origin: AI,
          overloads: [{ args: [{ arg: '+RO', t: 'number' }], origin: AI }]
        },
      ],
      relations: [{
        kind: 'REF',
        name: 'entries',
        modifies: 'pages',
        target: 'Page',
        many: true,
        origin: AI
      }],
      
    };
    await update(base, second, AI);
    const third: ClassDtoT = {
      name: 'Notebook',
      methods: [{
        name: 'find',
        origin: USER,
        overloads: [{ args: [{ arg: 'index', t: 'number' }], origin: AI }]
      }],
      relations: [],
      
    };
    await update(base, third, USER);
    const current = (await (await loggedFetch(`${base}/getClasses`)).json() as { classes: CurrentClassDtoT[] }).classes;
    assert.deepEqual(current, [classData(third)]);
    const response = await loggedFetch(`${base}/getClassesHistory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classNames: ['Notebook'] }),
    });
    assert.equal(response.status, 200);
    const classes = await response.json() as ClassHistoryT[];
    const record = classes.find((item) => item.name === 'Notebook');
    assert.ok(record);
    const heading = record.methods.find((item) => item.name === 'heading');
    const find = record.methods.find((item) => item.name === 'find');
    const entries = record.relations.find((item) => item.name === 'entries');
    assert.ok(heading && find && entries);
    assert.equal(heading.status, 'deleted');
    assert.equal(entries.status, 'deleted');
    assert.equal(find.status, 'active');
    assert.deepEqual(heading.history.map((item) => item.origin), [SCAN, AI, USER]);
    assert.deepEqual(entries.history.map((item) => item.origin), [SCAN, AI, USER]);
    assert.ok(heading.history.every((item) => !Number.isNaN(Date.parse(item.when))));
    assert.ok(entries.history.every((item) => !Number.isNaN(Date.parse(item.when))));
    assert.ok(find.overloads.some((item) => item.args[0]?.arg === 'name'));
    assert.ok(find.overloads.some((item) => item.args[0]?.arg === 'index'));
    assert.equal(find.overloads.find((item) => item.args[0]?.arg === 'name')?.status, 'deleted');
    assert.equal(find.overloads.find((item) => item.args[0]?.arg === 'index')?.status, 'active');
    assert.deepEqual(find.overloads.find((item) => item.args[0]?.arg === 'name')?.history.map((item) => item.origin), [SCAN, USER]);
    assert.deepEqual(find.overloads.find((item) => item.args[0]?.arg === 'index')?.history.map((item) => item.origin), [AI]);
  }));
}
