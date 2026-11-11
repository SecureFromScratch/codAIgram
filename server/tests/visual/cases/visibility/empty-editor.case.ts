import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = { title: 'retains in-memory classes after the editor is emptied and reopens them', prompt: { availability: 'available', text: 'Changing the editor does not erase the in-memory representation; an empty editor keeps the graph and lets classes reopen.' } };

export function registerEmptyEditorCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await editor.fill('');
    assert.equal(await page.locator('[data-eye-badge]').count(), 0);
    assert.equal(await page.locator('.joint-type-standard-headeredrectangle').count(), 1);
    await page.locator('.joint-type-standard-headeredrectangle').click();
    await page.waitForFunction((expected: string): boolean => [...document.querySelectorAll('.cm-content .cm-line')].map((line: Element): string | null => line.textContent).join('\n') === expected, text);
    assert.equal(await page.locator('[data-eye-badge]').count(), 1);
  });
}
