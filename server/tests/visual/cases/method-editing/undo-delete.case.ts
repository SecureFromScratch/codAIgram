import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';
import { waitForMethodNames } from '../../support/method-support.ts';

export const TEST_CASE_METADATA = {
  title: 'restores a selected and deleted method with undo in its original graph position',
  prompt: { availability: 'available', text: 'Delete the first method using selection and Backspace, then Ctrl+Z; verify editor text, method order, and its full tooltip signature are restored.' }
};

export function registerUndoDeleteMethodCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    const methodLine = editor.locator('.cm-line').filter({ hasText: 'addClass(name: string, publicMethods: string[])' });
    await methodLine.click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    assert.equal(await page.evaluate((): string => window.getSelection()?.toString() ?? ''), '  addClass(name: string, publicMethods: string[])');
    await page.keyboard.press('Backspace');
    await waitForMethodNames(['addPartialClass', 'connectClasses', 'recalcLayout']);
    await page.keyboard.press('Control+z');
    await page.waitForFunction((expected: string): boolean => [...document.querySelectorAll('.cm-content .cm-line')].map((line: Element): string | null => line.textContent).join('\n') === expected, text);
    await waitForMethodNames(['addClass', 'addPartialClass', 'connectClasses', 'recalcLayout']);
    const restored = page.locator('.joint-type-standard-headeredrectangle [data-method-index="0"]');
    assert.equal(await restored.getAttribute('data-method-tooltip'), 'addClass(name, publicMethods)\n-name: string\n-publicMethods: string[]');
    await restored.hover();
    const tooltip = page.getByRole('tooltip');
    await tooltip.waitFor();
    const content = (await tooltip.textContent() ?? '').replace(/\s+/g, ' ');
    for (const part of ['addClass(name, publicMethods)', 'name: string', 'publicMethods: string[]']) assert.ok(content.includes(part), part);
  });
}
