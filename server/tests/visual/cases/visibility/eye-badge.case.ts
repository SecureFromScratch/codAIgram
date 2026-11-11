import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = { title: 'renders a filled circular eye badge at the top left of editor-visible classes', prompt: { availability: 'available', text: 'Classes currently displayed in the text area have an open-eye emoji badge at the top left, within a small filled circle.' } };
export function registerEyeBadgeCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await editor.fill(`${text}\n\nClass\n  isPartial: bool`);
    const badges = page.locator('[data-eye-badge]');
    await page.waitForFunction((): boolean => document.querySelectorAll('[data-eye-badge]').length === 2);
    for (const badge of await badges.all()) {
      const info = await badge.evaluate((element: Element): { readonly text: string | null; readonly circle: string | null; readonly width: number; readonly height: number; readonly left: number; readonly top: number; readonly boxLeft: number | undefined; readonly boxTop: number | undefined } => {
        const circle = element.querySelector('circle');
        const box = element.closest('.joint-element')?.querySelector('rect');
        const bounds = element.getBoundingClientRect();
        const boxBounds = box?.getBoundingClientRect();
        return { text: element.textContent, circle: circle === null ? null : getComputedStyle(circle).fill, width: bounds.width, height: bounds.height, left: bounds.left, top: bounds.top, boxLeft: boxBounds?.left, boxTop: boxBounds?.top };
      });
      assert.ok(info.text?.includes('\u{1F441}') === true);
      assert.ok(info.circle !== null && info.circle !== 'none');
      assert.ok(Math.abs(info.width - info.height) <= 2 && info.width <= 32, 'badge is a small circle');
      assert.ok(info.boxLeft !== undefined && info.boxTop !== undefined, 'badge belongs to a class box');
      assert.ok(Math.abs(info.left - info.boxLeft) <= info.width && Math.abs(info.top - info.boxTop) <= info.height, 'badge is at the class box top left');
    }
  });
}
