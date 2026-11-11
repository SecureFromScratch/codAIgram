import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor, waitForLinkLabels } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = {
  title: 'removes an invalid ownership link, marks its declaration, and recovers when retyped',
  prompt: { availability: 'available', text: 'If OWNS is removed or mangled, remove the connector and mark the declaration with a red wavy syntax error; restore it when OWNS is retyped correctly.' }
};

export function registerInvalidOwnershipCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    for (const invalid of ['classes: Class[]', 'OWX classes: Class[]']) {
      await editor.fill(text.replace('OWNS classes: Class[]', invalid));
      await page.waitForFunction((): boolean => document.querySelectorAll('.joint-link').length === 0);
      const error = editor.locator('.dsl-error');
      await error.first().waitFor();
      assert.ok((await error.allTextContents()).join('').includes('classes: Class[]'));
      const style = await error.first().evaluate((element: HTMLElement): { readonly line: string; readonly style: string; readonly color: string } => ({ line: getComputedStyle(element).textDecorationLine, style: getComputedStyle(element).textDecorationStyle, color: getComputedStyle(element).textDecorationColor }));
      assert.ok(style.line.includes('underline'));
      assert.equal(style.style, 'wavy');
      assert.equal(style.color, 'rgb(220, 38, 38)');
      await editor.fill(text);
      await waitForLinkLabels(['classes', '*']);
      assert.equal(await editor.locator('.dsl-error').count(), 0);
    }
  });
}
