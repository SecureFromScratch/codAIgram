import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { page, setVisualClasses } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'opens chat with the selected member and class in its heading',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test: choosing Ask about... from a class member context menu opens chat and displays “Ask about <member> in <class>” in the chat heading.' },
      { when: '2026/11/25 00:00', text: 'Update the Ask about member visual test: verify both the member name and class name in the chat heading are italicized.' },
    ],
  },
};

export function registerAskAboutMemberHeaderCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([{
      name: 'AskHeaderClass',
      methods: [{ name: 'execute', overloads: [[]] }],
      relations: [],
    }]);
    await page.reload();
    const method: Locator = page.locator('[data-class-name="AskHeaderClass"] [data-method-index="0"]');
    await method.waitFor();
    await method.click({ button: 'right' });

    const menu: Locator = page.getByRole('menu', { name: 'Class actions' });
    await menu.waitFor();
    await menu.getByRole('menuitem', { name: 'Ask about...' }).click();

    const chat: Locator = page.getByRole('complementary', { name: 'Chat panel' });
    await chat.waitFor();
    const heading: Locator = chat.getByRole('heading', { name: 'Ask about execute in AskHeaderClass' });
    await heading.waitFor();
    assert.equal(await heading.innerText(), 'Ask about execute in AskHeaderClass');
    const italicizedNames: Locator = heading.locator('em');
    assert.equal(await italicizedNames.count(), 2);
    assert.equal(await italicizedNames.nth(0).innerText(), 'execute');
    assert.equal(await italicizedNames.nth(1).innerText(), 'AskHeaderClass');
  });
}
