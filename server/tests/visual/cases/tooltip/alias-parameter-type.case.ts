import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';

const OWNER_CLASS: string = 'AliasArgumentOwner';
const ALIAS_NAME: string = 'ArgsListT';
const CLASSES: readonly ClassDetails[] = [
  {
    name: OWNER_CLASS,
    methods: [
      {
        name: 'replace',
        overloads: [[{ arg: 'overrides', t: ALIAS_NAME }]],
      },
    ],
    relations: [],
  },
  {
    name: ALIAS_NAME,
    state: 'alias',
    aliasType: 'FieldType[]',
    methods: [],
    relations: [],
  },
];

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'shows an expanded type below an aliased method argument in its tooltip',
  prompt: {
    availability: 'available',
    history: [
      {
        when: '2026/11/25 00:00',
        text: 'Add a visual test: a method tooltip shows the real type of an aliased argument on an indented line below its name and alias type, wrapped in parentheses and prefixed by the mask emoji.',
      },
    ],
  },
};

export function registerAliasParameterTypeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();

    const owner: Locator = page.locator(`[data-class-name="${OWNER_CLASS}"]`);
    await owner.waitFor();
    await owner.locator('[data-method-tooltip*="overrides:"]').hover();

    const tooltip: Locator = page.getByRole('tooltip');
    await tooltip.waitFor();
    const argumentLine: Locator = tooltip.locator('.tooltip-parameter');
    const expandedLine: Locator = tooltip.locator('.tooltip-parameter-expansion');
    assert.match(await argumentLine.textContent() ?? '', /overrides:\s*.*ArgsListT/u);
    assert.equal(await expandedLine.textContent(), '(\u{1F3AD}FieldType[])');

    const argumentBounds: DOMRect = await argumentLine.evaluate((element: Element) => element.getBoundingClientRect());
    const expandedBounds: DOMRect = await expandedLine.evaluate((element: Element) => element.getBoundingClientRect());
    const indentation: number = await expandedLine.evaluate((element: Element) => Number.parseFloat(window.getComputedStyle(element).paddingLeft));
    assert.ok(expandedBounds.y > argumentBounds.y, 'The expanded type should be on the line below its argument.');
    assert.ok(indentation > 0, 'The expanded type should be indented relative to its argument line.');
  });
}
