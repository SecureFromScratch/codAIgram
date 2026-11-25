import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Locator } from 'playwright';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page } from '../../test-support.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'opens the Semantics page from the top bar',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/23 09:35', text: 'Add a Semantics page to the top bar alongside Classes and Tests. Add a visual test that clicks Semantics and verifies the page is displayed.' },
    ],
  },
};

export function registerSemanticsPageCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const semanticsTab: Locator = page.getByRole('tab', { name: 'Semantics' });
    await semanticsTab.waitFor({ state: 'visible' });
    await semanticsTab.click();

    assert.equal(await semanticsTab.getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByRole('heading', { name: 'Semantics', level: 1 }).isVisible(), true);
    assert.equal(await page.locator('.semantics-workspace').count(), 1);
    assert.equal(await page.locator('.editor').count(), 0);
    assert.equal(await page.locator('.tests-tree').count(), 0);
  });
}
