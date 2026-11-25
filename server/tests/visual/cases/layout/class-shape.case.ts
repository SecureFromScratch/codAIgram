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
  title: 'class shape follows its members when the selected class changes',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/16 00:00', text: 'well, drawing should not be dependednt on order or selectivity of a class - its shape depends on its content' },
    ],
  },
};

export function registerClassShapeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([
      { 
        name: 'Alpha', 
        methods: [], 
        relations: [{ kind: 'REF', name: 'other', target: 'Beta', many: false }], 
      },
      { 
        name: 'Beta', 
        methods: [{ name: 'run', overloads: [[]] }], 
        relations: [], 
      },
    ]);
    await page.reload();
    const alpha: Locator = page.locator('[data-class-name="Alpha"]');
    const beta: Locator = page.locator('[data-class-name="Beta"]');
    await alpha.waitFor();
    assert.ok((await alpha.getAttribute('class'))?.includes('joint-type-standard-rectangle'));
    assert.ok((await beta.getAttribute('class'))?.includes('joint-type-standard-headeredrectangle'));
    await beta.dblclick();
    await page.waitForFunction(() => document.querySelector('.cm-content')?.textContent?.startsWith('Beta'));
    assert.ok((await alpha.getAttribute('class'))?.includes('joint-type-standard-rectangle'));
    assert.ok((await beta.getAttribute('class'))?.includes('joint-type-standard-headeredrectangle'));
  });
}
