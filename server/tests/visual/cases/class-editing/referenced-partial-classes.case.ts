import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';
import { resetOwnershipEditor } from '../../support/editor-support.ts';

export const TEST_CASE_METADATA = {
  title: 'allows new and referenced partial classes to be defined and edited',
  prompt: { availability: 'available', text: 'A new class name and a partial class referenced as a property, method argument, or OWNS type are valid declarations and can later be completed.' }
};

export function registerReferencedPartialClassesCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text } = await resetOwnershipEditor();
    const references = `${text}\n  property: PropertyType\n  use(value: ArgumentType)\nOWNS owned: OwnedType[]`;
    for (const name of ['FreshClass', 'PropertyType', 'ArgumentType', 'OwnedType']) {
      const source = `${references}\n\n${name}`;
      await editor.fill(source);
      assert.equal(await editor.locator('.dsl-error').count(), 0, `${name} can be declared`);
      await editor.fill(`${source}\n  added()`);
      await page.waitForFunction((className: string): boolean => document.querySelector(`[data-class-name="${className}"]`)?.textContent?.includes('added') === true, name);
      assert.equal(await editor.locator('.dsl-error').count(), 0);
    }
  });
}
