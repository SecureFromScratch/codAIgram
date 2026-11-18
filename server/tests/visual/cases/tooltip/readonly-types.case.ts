import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page, setVisualClasses } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'omits readonly modifiers from displayed field and argument types',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 23:42', text: 'add visual test - Readonly<>, readonly type modifiers are stripped when display in attribute\'s type or method overload argument.' },
    ],
  },
};

export function registerReadonlyTypesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([{
      name: 'Example',
      methods: [
        { name: 'first', overloads: [[{ arg: '+RO', t: 'Readonly<Widget>' }]] },
        { name: 'second', overloads: [[{ arg: '+RO', t: 'readonly string[]' }]] },
        { name: 'run', overloads: [[{ arg: 'widget', t: 'Readonly<Widget>' }, { arg: 'names', t: 'readonly string[]' }]] },
      ],
      relations: [],
      
    }]);
    await page.reload();
    const box: import('playwright').Locator = page.locator('[data-class-name="Example"]');
    await box.waitFor();
    const text: string = await box.locator('text[joint-selector="bodyText"]').textContent() ?? '';
    assert.ok(text.includes('first: Widget'));
    assert.ok(text.includes('second: string[]'));
    assert.ok(!text.includes('Readonly'), text);
    assert.ok(!text.includes('readonly'));
    await box.locator('[data-method-tooltip^="run("]').hover();
    const tooltip: string = await page.getByRole('tooltip').innerText();
    assert.ok(tooltip.includes('Widget'));
    assert.ok(tooltip.includes('string[]'));
    assert.ok(!tooltip.includes('Readonly'));
    assert.ok(!tooltip.includes('readonly'));
  });
}
