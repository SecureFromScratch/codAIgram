import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import { page, setVisualClasses } from '../../test-support.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'shows each class source file and modification date when hovering its name',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 23:42', text: 'add a visual test for every modified class - modification date and file the class is defined in appear in tooltip when hovering classname (if thi requires a server api change and stored data change - do those first and modify server tests accordingly)' },
    ],
  },
};

const CLASSES: readonly ClassDetails[] = [
  { name: 'Alpha', methods: [{ name: 'work', overloads: [[]] }], relations: [],  sourceFile: 'src/alpha.ts', modifiedAt: '2026-11-15T09:35:00.000Z' },
  { name: 'Beta', methods: [{ name: 'run', overloads: [[]] }], relations: [],  sourceFile: 'src/beta.ts', modifiedAt: '2026-11-14T12:00:00.000Z' },
  { name: 'Gamma', methods: [], relations: [], state: 'partial', sourceFile: 'src/gamma.ts', modifiedAt: '2026-11-13T08:15:00.000Z' },
];

export function registerClassSourceCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();
    for (const item of CLASSES) {
      const name: import('playwright').Locator = page.locator(`[data-class-name="${item.name}"] text[joint-selector="headerText"], [data-class-name="${item.name}"] text[joint-selector="label"]`);
      await name.hover();
      const tooltip: import('playwright').Locator = page.getByRole('tooltip');
      await tooltip.waitFor();
      const text: string = await tooltip.innerText();
      assert.ok(text.includes(item.name));
      assert.ok(item.sourceFile && text.includes(item.sourceFile));
      assert.ok(item.modifiedAt && text.includes(item.modifiedAt));
    }
  });
}
