import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { page, setVisualClasses, VISUAL_CLASSES } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'toggles the Show actual code checkbox on and off',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test: right-click the class name and verify Show actual code toggles from unchecked to checked and back to unchecked.' },
    ],
  },
};

export function registerClassNameContextMenuToggleActualCodeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(VISUAL_CLASSES);
    await page.reload();
    const className: Locator = page.locator('[data-class-name="ClassDiagram"] text[joint-selector="headerText"]');
    await className.waitFor();
    await className.click({ button: 'right' });

    const menu: Locator = page.getByRole('menu', { name: 'Class actions' });
    await menu.waitFor();
    const actualCodeOption: Locator = menu.getByRole('menuitemcheckbox', { name: 'Show actual code' });
    await actualCodeOption.waitFor();
    assert.equal(await actualCodeOption.getAttribute('aria-checked'), 'false');
    assert.match(await actualCodeOption.innerText(), /^☐\s*Show actual code$/);

    await actualCodeOption.click();
    assert.equal(await actualCodeOption.getAttribute('aria-checked'), 'true');
    assert.match(await actualCodeOption.innerText(), /^☑\s*Show actual code$/);

    await actualCodeOption.click();
    assert.equal(await actualCodeOption.getAttribute('aria-checked'), 'false');
    assert.match(await actualCodeOption.innerText(), /^☐\s*Show actual code$/);
  });
}
