import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { page, setVisualClasses, VISUAL_CLASSES } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'closes the class context menu on an outside click without selecting the clicked class',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test that clicking outside an open class context menu closes it without allowing the click to activate the class underneath.' },
    ],
  },
};

export function registerOutsideClickClosesContextMenuCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(VISUAL_CLASSES);
    await page.reload();
    const contextClass: Locator = page.locator('[data-class-name="ClassDiagram"]');
    const clickedClass: Locator = page.locator('[data-class-name="Class"]');
    await contextClass.waitFor();
    await clickedClass.waitFor();
    await contextClass.click({ button: 'right' });

    const menu: Locator = page.getByRole('menu', { name: 'Class actions' });
    await menu.waitFor();
    const selectionBeforeClick: string[] = await page.evaluate(() => {
      const app: { getSelection?: () => readonly string[] } | undefined =
        (window as Window & { __app?: { getSelection?: () => readonly string[] } }).__app;
      return [...(app?.getSelection?.() ?? [])];
    });
    await clickedClass.click();
    await menu.waitFor({ state: 'detached' });

    const selectedClasses: string[] = await page.evaluate(() => {
      const app: { getSelection?: () => readonly string[] } | undefined =
        (window as Window & { __app?: { getSelection?: () => readonly string[] } }).__app;
      return [...(app?.getSelection?.() ?? [])];
    });
    assert.deepEqual(selectedClasses, selectionBeforeClick);
  });
}
