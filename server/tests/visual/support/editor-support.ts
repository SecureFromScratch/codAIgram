import type { Locator } from 'playwright';
import { page } from '../test-support.ts';

export type EditorStateT = {
  readonly editor: Locator;
  readonly text: string;
};

export async function resetOwnershipEditor(): Promise<EditorStateT> {
  await page.reload();
  await page.locator('.joint-type-standard-rectangle').first().waitFor();
  const editor = page.getByRole('textbox', { name: 'Diagram text' });
  return { editor, text: (await editor.locator('.cm-line').allTextContents()).join('\n') };
}

export async function waitForLinkLabels(labels: readonly string[]): Promise<void> {
  await page.waitForFunction((expected: readonly string[]): boolean => JSON.stringify([...document.querySelectorAll('.joint-link text')].map((item: Element): string | null => item.textContent)) === JSON.stringify(expected), labels);
}
