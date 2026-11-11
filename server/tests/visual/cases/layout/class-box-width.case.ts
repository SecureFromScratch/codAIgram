import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';

export const TEST_CASE_METADATA = {
  title: 'keeps class boxes within 200 pixels',
  prompt: { availability: 'available', text: 'Add a visual test that class boxes are no wider than 200 pixels.' }
};

export function registerClassBoxWidthCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const widths: { readonly source: number; readonly target: number } = await page.evaluate(() => {
      const source = document.querySelector('.joint-type-standard-headeredrectangle rect');
      const target = document.querySelector('.joint-type-standard-rectangle rect');
      if (source === null || target === null) throw new Error('Expected class boxes.');
      return { source: source.getBoundingClientRect().width, target: target.getBoundingClientRect().width };
    });
    assert.ok(widths.source <= 200, `ClassDiagram width is ${String(widths.source)}px`);
    assert.ok(widths.target <= 200, `Class width is ${String(widths.target)}px`);
  });
}
