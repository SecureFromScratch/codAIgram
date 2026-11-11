import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor, waitForLinkLabels } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = {
  title: 'retains the many marker without a connector member label for unnamed ownership',
  prompt: { availability: 'available', text: 'When OWNS has only a type, remove the connector member annotation but retain the many-arity star.' }
};

export function registerUnnamedOwnershipCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await editor.fill(text.replace('OWNS classes: Class[]', 'OWNS Class[]'));
    await waitForLinkLabels(['*']);
    assert.equal(await page.locator('.joint-type-standard-rectangle text').textContent(), 'Class');
    await editor.fill(text);
    await waitForLinkLabels(['classes', '*']);
  });
}
