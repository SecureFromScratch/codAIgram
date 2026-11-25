import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { page, setVisualClasses } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'offers Ask about from a text editor member context menu',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test that right-clicking a class member in the text editor opens a context menu containing the Ask about... option.' },
    ],
  },
};

export function registerEditorMemberContextMenuAskAboutCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([{
      name: 'EditorContextMenuClass',
      methods: [{ name: 'execute', overloads: [[]] }],
      relations: [],
    }]);
    await page.reload();
    await page.waitForFunction(() => Boolean((window as Window & { __app?: { selectClass?: (name: string) => void } }).__app?.selectClass));
    await page.evaluate(() => (window as Window & { __app?: { selectClass?: (name: string) => void } }).__app?.selectClass?.('EditorContextMenuClass'));
    await page.locator('.cm-content').waitFor();
    const editorText: string = await page.locator('.cm-content').innerText();
    assert.ok(editorText.includes('execute()'), `Editor did not load the expected method. Text: ${editorText}`);
    const methodLine: Locator = page.locator('.cm-line').filter({ hasText: 'execute()' });
    await methodLine.waitFor();
    await methodLine.click({ button: 'right' });

    const menu: Locator = page.getByRole('menu', { name: 'Text member actions' });
    await menu.waitFor();
    const askAbout: Locator = menu.getByRole('menuitem', { name: 'Ask about...' });
    await askAbout.waitFor();
    assert.equal(await askAbout.innerText(), 'Ask about...');
  });
}
