import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = { title: 'displays only the double-clicked class text and its eye badge', prompt: { availability: 'available', text: 'Double-clicking a class removes all other markup from the editor and leaves only the double-clicked class with its open-eye badge.' } };

export function registerDoubleClickIsolateCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await editor.fill(`${text}\n\nClass\n  isPartial: bool`);
    const target = page.locator('.joint-type-standard-headeredrectangle').filter({ hasText: 'isPartial' });
    await target.dblclick();
    await page.waitForFunction((): boolean => [...document.querySelectorAll('.cm-content .cm-line')].map((line: Element): string | null => line.textContent).join('\n') === 'Class\n  isPartial: bool');
    assert.equal(await page.locator('[data-eye-badge]').count(), 1);
    assert.equal(await target.locator('[data-eye-badge]').count(), 1);
    assert.equal(await page.locator('.joint-type-standard-headeredrectangle').count(), 2, 'hidden source classes remain on the graph');
  });
}
