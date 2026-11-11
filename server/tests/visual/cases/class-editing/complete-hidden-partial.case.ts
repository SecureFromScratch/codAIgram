import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = { title: 'completes a hidden partial class referenced by another visible class', prompt: { availability: 'available', text: 'A hidden partial class referenced by another class can be displayed and completed without a conflict.' } };

export function registerCompleteHiddenPartialCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await page.locator('[data-class-name="Class"]').click();
    await page.waitForFunction((): boolean => document.querySelectorAll('[data-eye-badge]').length === 2);
    await page.locator('[data-class-name="Class"]').click();
    await page.waitForFunction((): boolean => document.querySelectorAll('[data-eye-badge]').length === 1);
    await editor.fill(`${text}\n\nClass`);
    assert.equal(await editor.locator('.dsl-error').count(), 0);
    await editor.fill(`${text}\n\nClass\n  added()`);
    await page.waitForFunction((): boolean => document.querySelector('[data-class-name="Class"]')?.textContent?.includes('added') === true);
    assert.equal(await editor.locator('.dsl-error').count(), 0);
  });
}
