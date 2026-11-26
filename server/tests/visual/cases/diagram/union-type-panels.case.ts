import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';

const UNION_NAME: string = 'FieldUnionT';
const CLASSES: readonly ClassDetails[] = [
  {
    name: UNION_NAME,
    state: 'union',
    aliasType: 'string | ArgsListT | Widget',
    methods: [],
    relations: [],
  },
  {
    name: 'ArgsListT',
    state: 'alias',
    aliasType: 'FieldType[]',
    methods: [],
    relations: [],
  },
  {
    name: 'Widget',
    methods: [{ name: 'name', overloads: [[{ arg: '+RO', t: 'string' }]] }],
    relations: [],
  },
  {
    name: 'FieldType',
    methods: [{ name: 'arg', overloads: [[{ arg: '+RO', t: 'string' }]] }],
    relations: [],
  },
];

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'renders union members as separated panels and expands aliased members',
  prompt: {
    availability: 'available',
    history: [
      {
        when: '2026/11/25 00:00',
        text: 'Add a visual test for union classboxes: show the shuffle emoji before the union name, display each alternative in its own members panel separated by a line, and show an alias member’s real type beneath it in parentheses with the mask emoji. A union has at least two panels.',
      },
    ],
  },
};

export function registerUnionTypePanelsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();

    const unionBox: Locator = page.locator(`[data-class-name="${UNION_NAME}"]`);
    await unionBox.waitFor();
    const header: Locator = unionBox.locator('text[joint-selector="headerText"]');
    assert.match(await header.textContent() ?? '', /^\u{1F500}FieldUnionT$/u);

    const body: Locator = unionBox.locator('text[joint-selector="bodyText"]');
    const rows: { text: string; y: number }[] = await body.locator('tspan').evaluateAll((spans: SVGElement[]) => spans.map((span: SVGElement) => ({
      text: span.textContent ?? '',
      y: span.getBoundingClientRect().y,
    })));
    const findRow: (fragment: string) => { text: string; y: number } = (fragment: string) => {
      const row: { text: string; y: number } | undefined = rows.find((item) => item.text.includes(fragment));
      assert.ok(row, `Expected a union panel row containing ${fragment}.`);
      return row;
    };
    const firstPanel: { text: string; y: number } = findRow('string');
    const aliasPanel: { text: string; y: number } = findRow('ArgsListT');
    const expandedAlias: { text: string; y: number } = findRow('FieldType[]');
    const thirdPanel: { text: string; y: number } = findRow('Widget');
    const separatorRows: { text: string; y: number }[] = rows.filter((row) => row.text.includes('\u2500'));

    assert.ok(aliasPanel.y > firstPanel.y, 'The second union member should appear below the first.');
    assert.ok(expandedAlias.y > aliasPanel.y, 'An aliased union member should show its expanded type on the following line.');
    assert.match(expandedAlias.text, /\(\u{1F3AD}FieldType\[\]\)/u);
    assert.ok(thirdPanel.y > expandedAlias.y, 'The third union member should follow the alias expansion.');
    assert.equal(separatorRows.length, 2, 'Three union members should have a separator between each adjacent pair.');
    assert.ok(separatorRows[0]!.y > firstPanel.y && separatorRows[0]!.y < aliasPanel.y, 'The first separator should divide the first and second member panels.');
    assert.ok(separatorRows[1]!.y > expandedAlias.y && separatorRows[1]!.y < thirdPanel.y, 'The second separator should divide the second and third member panels.');
  });
}
