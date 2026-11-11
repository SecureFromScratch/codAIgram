import { test } from 'node:test';
import { resetOwnershipEditor } from '../../support/editor-support.ts';
import { waitForMethodNames } from '../../support/method-support.ts';

export const TEST_CASE_METADATA = {
  title: 'updates the class box when a method is renamed',
  prompt: { availability: 'available', text: 'Changing a method name reflects in the class box.' }
};

export function registerRenameMethodCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await editor.fill(text.replace('addPartialClass', 'createPartialClass'));
    await waitForMethodNames(['addClass', 'createPartialClass', 'connectClasses', 'recalcLayout']);
  });
}
