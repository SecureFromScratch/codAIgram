import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = {
  title: 'updates method tooltip argument names, types, and count',
  prompt: { availability: 'available', text: 'Changing method argument names, types, and amount reflects in the tooltip.' }
};

export function registerMethodTooltipArgumentsCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await editor.fill(text.replace('addClass(name: string, publicMethods: string[])', 'addClass(label: number, option: boolean, items: Item[])'));
    const method = page.locator('.joint-type-standard-headeredrectangle [data-method-tooltip^="addClass("]');
    await page.waitForFunction((): boolean => document.querySelector('[data-method-tooltip^="addClass("]')?.getAttribute('data-method-tooltip') === 'addClass(label, option, items)\n-label: number\n-option: boolean\n-items: Item[]');
    await method.hover();
    const tooltip = page.getByRole('tooltip');
    await tooltip.waitFor();
    const content = (await tooltip.textContent() ?? '').replace(/\s+/g, ' ');
    for (const part of ['addClass(label, option, items)', 'label: number', 'option: boolean', 'items: Item[]']) assert.ok(content.includes(part), part);
  });
}
