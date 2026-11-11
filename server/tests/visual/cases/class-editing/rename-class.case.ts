import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = {
  title: 'updates the class box when its title changes',
  prompt: { availability: 'available', text: 'Changing a class title reflects in its class box.' }
};

export function registerRenameClassCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    await editor.fill(text.replace(/^ClassDiagram/, 'NewDiagram'));
    await page.waitForFunction((): boolean => document.querySelector('.joint-type-standard-headeredrectangle text')?.textContent === 'NewDiagram');
  });
}
