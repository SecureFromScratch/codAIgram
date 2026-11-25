import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { page, setVisualClasses, VISUAL_CLASSES } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'offers Ask about from a class member context menu',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test that right-clicking a class member opens a context menu containing the Ask about... option.' },
    ],
  },
};

export function registerMemberContextMenuAskAboutCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(VISUAL_CLASSES);
    await page.reload();
    const method: Locator = page.locator('[data-class-name="ClassDiagram"] [data-method-index="0"]');
    await method.waitFor();
    await method.click({ button: 'right' });

    const menu: Locator = page.getByRole('menu', { name: 'Class actions' });
    await menu.waitFor();
    const askAbout: Locator = menu.getByRole('menuitem', { name: 'Ask about...' });
    await askAbout.waitFor();
    assert.equal(await askAbout.innerText(), 'Ask about...');
  });
}
