import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = { title: 'toggles a graph class markup and eye badge when clicked', prompt: { availability: 'available', text: 'Clicking a graph class adds its markup and eye badge; clicking it again removes both.' } };

export function registerClickToggleCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    const target = page.locator('.joint-type-standard-rectangle').filter({ hasText: 'Class' });
    assert.equal(await target.locator('[data-eye-badge]').count(), 0);
    await target.click();
    await page.waitForFunction((): boolean => document.querySelectorAll('[data-eye-badge]').length === 2);
    assert.equal((await editor.locator('.cm-line').allTextContents()).join('\n'), `${text}\n\nClass`);
    await page.locator('.joint-type-standard-rectangle').filter({ hasText: 'Class' }).click();
    await page.waitForFunction((): boolean => document.querySelectorAll('[data-eye-badge]').length === 1);
    assert.equal((await editor.locator('.cm-line').allTextContents()).join('\n'), text);
  });
}
