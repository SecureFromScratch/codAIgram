import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor, waitForLinkLabels } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = {
  title: 'shows a question mark and removes a partial target when its owned type is missing',
  prompt: { availability: 'available', text: 'If Class[] is removed completely, replace the partial Class box with a question mark and restore it after correction.' }
};

export function registerMissingOwnedTypeCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await editor.fill(text.replace('OWNS classes: Class[]', 'OWNS classes:'));
    await page.waitForFunction((): boolean => [...document.querySelectorAll('.joint-type-standard-rectangle text')].some((item: Element): boolean => item.textContent === '?'));
    const targets = await page.locator('.joint-type-standard-rectangle text').allTextContents();
    assert.ok(!targets.includes('Class'));
    assert.ok(targets.includes('?'));
    await editor.fill(text);
    await waitForLinkLabels(['classes', '*']);
  });
}
