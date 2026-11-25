import type { Locator } from 'playwright';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page, setVisualClasses } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { 
    availability: string; 
    history: { when: string; text: string }[] 
  };
} = {
  title: 'marks writable attributes and mutable method arguments with a pencil',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 23:42', text: 'add visual test: attributes that are NOT readonly have a pen/pencil (or similar) emoji prefixing them\nthe same is true for moutable method args in overloads (note that string is NOT mutable ever, neither is number afaik)' },
      { when: '2026/11/16 00:00', text: "I don't see these tests: add visual test: attributes that are NOT readonly have a pen/pencil (or similar) emoji prefixing them the same is true for moutable method args in overloads (note that string is NOT mutable ever, neither is number afaik)" },
      { when: '2026/11/16 12:30', text: "adjust visual tests regarding having pencil before class member - the pencil should be before the type, no space between it and the type, cancel attribute's indentation." },
    ],
  },
};

export function registerMutableMembersCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([{
      name: 'Example',
      methods: [
        { 
          name: 'editable', 
          overloads: [[{ arg: '+RW', t: 'string' }]] 
        },
        { 
          name: 'fixed', 
          overloads: [[{ arg: '+RO', t: 'string' }]] 
        },
        { 
          name: 'run', 
          overloads: [
          [{ arg: 'names', t: 'string[]' }, { arg: 'title', t: 'string' }, { arg: 'count', t: 'number' }],
          [{ arg: 'values', t: 'readonly string[]' }, { arg: 'widget', t: 'Widget' }],
        ] 
        },
      ],
      relations: [],
      
    }]);
    await page.reload();
    const box: Locator = page.locator('[data-class-name="Example"]');
    await box.waitFor();
    const text: string = await box.locator('text[joint-selector="bodyText"]').textContent() ?? '';
    assert.match(text, /editable: ✏️string/);
    assert.doesNotMatch(text, /✏️\s*editable|fixed: ✏️/);
    const editable: Locator = box.locator('[data-method-tooltip^="editable:"]');
    assert.equal(await editable.textContent(), 'editable: ✏️string');
    const methods: Locator = box.locator('[data-method-tooltip^="run("]');
    await methods.nth(0).hover();
    let tooltip: string = await page.getByRole('tooltip').innerText();
    assert.match(tooltip, /✏️string\[\]/);
    assert.doesNotMatch(tooltip, /✏️\s*names|✏️string\b(?!\[)/);
    await methods.nth(1).hover();
    tooltip = await page.getByRole('tooltip').innerText();
    assert.match(tooltip, /✏️Widget/);
    assert.doesNotMatch(tooltip, /✏️\s*(?:widget|values)|✏️string\[\]/);
  });
}
