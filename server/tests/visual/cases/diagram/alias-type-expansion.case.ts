import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';

const OWNER_CLASS: string = 'AliasOwner';
const ALIAS_NAME: string = 'ArgsListT';
const CLASSES: readonly ClassDetails[] = [
  {
    name: OWNER_CLASS,
    methods: [
      {
        name: 'overrides',
        overloads: [[{ arg: '+RO', t: ALIAS_NAME }]],
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
  title: 'shows an alias type and its expanded type below a member field',
  prompt: {
    availability: 'available',
    history: [
      {
        when: '2026/11/25 00:00',
        text: 'Add a visual test: when a member field uses a type alias, show the real type on the next indented line, wrapped in parentheses and prefixed by the mask emoji.',
      },
    ],
  },
};

export function registerAliasTypeExpansionCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();

    const box: Locator = page.locator(`[data-class-name="${OWNER_CLASS}"]`);
    await box.waitFor();
    const body: Locator = box.locator('text[joint-selector="bodyText"]');
    const renderedText: string = await body.textContent() ?? '';
    assert.match(renderedText, /overrides:\s*ArgsListT/u);
    assert.match(renderedText, /\(🎭FieldType\[\]\)/u);

    const linePositions: { text: string; y: number; x: number }[] = await body.locator('tspan').evaluateAll((spans: SVGElement[]) => spans.map((span: SVGElement) => {
      const bounds: DOMRect = span.getBoundingClientRect();
      return {
      text: span.textContent ?? '',
      y: bounds.y,
      x: bounds.x,
    }; }));
    const aliasLine: { text: string; y: number; x: number } | undefined = linePositions.find((line) => line.text.includes('overrides:') && line.text.includes('ArgsListT'));
    const expandedLine: { text: string; y: number; x: number } | undefined = linePositions.find((line) => line.text.includes('🎭FieldType[]'));
    assert.ok(aliasLine, 'The aliased field should be visible in its classbox.');
    assert.ok(expandedLine, 'The expanded type should be visible on a separate line.');
    assert.ok(expandedLine.y > aliasLine.y, `The expanded type should appear below the alias field: ${JSON.stringify(linePositions)}.`);
    assert.match(expandedLine.text, /^\s{9}\(/u, 'The expanded type should be indented relative to the alias field.');
    assert.match(expandedLine.text, /\(🎭FieldType\[\]\)$/u, 'The expanded type should be parenthesized.');
  });
}
