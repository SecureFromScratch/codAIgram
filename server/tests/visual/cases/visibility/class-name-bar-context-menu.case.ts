import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';

const CLASS_NAME: string = 'ShortName';
const CLASSES: readonly ClassDetails[] = [{
  name: CLASS_NAME,
  methods: [{ name: 'run', overloads: [[]] }],
  relations: [],
}];

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'opens the class context menu from the empty portion of its name bar',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test: right-clicking the unused background of a short class name bar opens its context menu, with name-bar options available across the whole bar and not only over the title text.' },
    ],
  },
};

export function registerClassNameBarContextMenuCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();

    const classBox: Locator = page.locator(`[data-class-name="${CLASS_NAME}"]`);
    const header: Locator = classBox.locator('rect[joint-selector="header"]');
    const title: Locator = classBox.locator('text[joint-selector="headerText"]');
    await header.waitFor();
    await title.waitFor();
    const hitPoint: { x: number; y: number } = await page.evaluate((className: string) => {
      const headerElement: SVGRectElement | null = document.querySelector(`[data-class-name="${className}"] rect[joint-selector="header"]`);
      const titleElement: SVGTextElement | null = document.querySelector(`[data-class-name="${className}"] text[joint-selector="headerText"]`);
      if (!headerElement || !titleElement) window.logAndThrow(new Error('Expected the class name bar and title.'));
      const headerBounds: DOMRect = headerElement.getBoundingClientRect();
      const titleBounds: DOMRect = titleElement.getBoundingClientRect();
      const x: number = headerBounds.right - 5;
      if (x <= titleBounds.right) window.logAndThrow(new Error('The test class title must leave unused space in its name bar.'));
      return { x, y: headerBounds.top + headerBounds.height / 2 };
    }, CLASS_NAME);

    await page.mouse.click(hitPoint.x, hitPoint.y, { button: 'right' });
    const menu: Locator = page.getByRole('menu', { name: 'Class actions' });
    await menu.waitFor();
    const actualCodeOption: Locator = menu.getByRole('menuitemcheckbox', { name: 'Show actual code' });
    await actualCodeOption.waitFor();
    assert.equal(await actualCodeOption.getAttribute('aria-checked'), 'false');
  });
}
