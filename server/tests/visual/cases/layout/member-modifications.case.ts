import type { Locator } from "playwright";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DatabaseClassChange } from '../../../../dist/memory-repository.js';
import { page, setVisualClasses } from '../../test-support.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'renders latest added or changed members in blue and deleted members with strikethrough',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/17 09:35', text: 'add these visual tests - a method changed since last time (either new or has any changed overload of any kind) has blue text\na method that was deleted since last time (all overloads are deleted) has strikethrough effect on its font\na membervar field changed/added since last time - has blue font\na membervar field that was deleted since last time has a strikethrough effect on its font' },
    ],
  },
};

const LAST_CHANGE: DatabaseClassChange = {
  origin: { kind: 'scan', name: 'scanner', version: 'v2', },
  changedAt: '2026-11-17T09:35:00.000Z',
  classes: [{
    name: 'Example',
    status: 'modified',
    changes: [
      {
        kind: 'member',
        before: 'absent',
        after: { name: 'addedMethod', overloads: [{ args: [] }], },
        overloadRenames: [],
      },
      {
        kind: 'member',
        before: {
          name: 'changedField',
          overloads: [{ args: [{ arg: '+RO', t: 'string' }] }],
        },
        after: {
          name: 'changedField',
          overloads: [{ args: [{ arg: '+RO', t: 'number' }] }],
        },
        overloadRenames: [],
      },
      {
        kind: 'member',
        before: { name: 'deletedMethod', overloads: [{ args: [] }], },
        after: 'absent',
        overloadRenames: [],
      },
      {
        kind: 'member',
        before: {
          name: 'deletedField',
          overloads: [{ args: [{ arg: '+RO', t: 'string' }] }],
        },
        after: 'absent',
        overloadRenames: [],
      },
    ],
  }],
};

export function registerMemberModificationsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([{
      name: 'Example',
      methods: [
        { name: 'addedMethod', overloads: [[]] },
        { 
          name: 'changedField', 
          overloads: [[{ arg: '+RO', t: 'number' }]] 
        },
      ],
      relations: [],
    }], LAST_CHANGE);
    await page.reload();
    const changed: Locator = page.locator('[data-class-name="Example"] [data-member-change="changed"]');
    const deleted: Locator = page.locator('[data-class-name="Example"] [data-member-change="deleted"]');
    assert.equal(await changed.count(), 2);
    assert.equal(await deleted.count(), 2);
    for (let index: number = 0; index < await changed.count(); index += 1) {
      assert.equal(await changed.nth(index).evaluate((element: Element) => getComputedStyle(element).fill), 'rgb(37, 99, 235)');
    }
    for (let index: number = 0; index < await deleted.count(); index += 1) {
      assert.match(await deleted.nth(index).evaluate((element: Element) => getComputedStyle(element).textDecorationLine), /line-through/);
    }
  });
}
