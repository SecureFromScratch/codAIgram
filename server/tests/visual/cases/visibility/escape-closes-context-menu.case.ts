import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { page, setVisualClasses, VISUAL_CLASSES } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'closes the class context menu when Escape is pressed',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test that opens a class context menu and verifies pressing Escape closes it.' },
    ],
  },
};

export function registerEscapeClosesContextMenuCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(VISUAL_CLASSES);
    await page.reload();
    const classBox: Locator = page.locator('[data-class-name="ClassDiagram"]');
    await classBox.waitFor();
    await classBox.click({ button: 'right' });

    const menu: Locator = page.getByRole('menu', { name: 'Class actions' });
    await menu.waitFor();
    await page.keyboard.press('Escape');

    await menu.waitFor({ state: 'detached' });
    assert.equal(await classBox.count(), 1);
  });
}
