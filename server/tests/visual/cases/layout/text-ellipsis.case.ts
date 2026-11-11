import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.ts';

type RectangleT = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number; readonly width: number; readonly height: number };
type TextRowT = { readonly text: string | null; readonly rect: RectangleT };
type DiagramTextT = { readonly heading: string | null; readonly headingRect: RectangleT; readonly headerRect: RectangleT; readonly rows: readonly TextRowT[]; readonly sourceRect: RectangleT; readonly target: string | null; readonly targetRect: RectangleT; readonly targetBoxRect: RectangleT; readonly marker: readonly (string | null)[] };

export const TEST_CASE_METADATA = { title: 'keeps diagram text on one line per item, fitting or ending in an ellipsis', prompt: { availability: 'available', text: 'All text in the diagram must either fit on one line or end in an ellipsis; it must not wrap.' } };

async function inspectDiagramText(): Promise<DiagramTextT> {
  return page.evaluate((): DiagramTextT => {
    const source = document.querySelector('.joint-type-standard-headeredrectangle');
    const target = document.querySelector('.joint-type-standard-rectangle');
    if (source === null || target === null) throw new Error('Expected both class boxes.');
    const heading = source.querySelectorAll('text').item(0);
    const body = source.querySelectorAll('text').item(1);
    const targetText = target.querySelector('text');
    const header = source.querySelectorAll('rect').item(1);
    const sourceBox = source.querySelector('rect');
    const targetBox = target.querySelector('rect');
    if (heading === null || body === null || targetText === null || header === null || sourceBox === null || targetBox === null) throw new Error('Diagram text or bounds are missing.');
    const rows = [...body.querySelectorAll(':scope > tspan')].map((row: Element): TextRowT => ({ text: row.textContent, rect: row.getBoundingClientRect() }));
    return { heading: heading.textContent, headingRect: heading.getBoundingClientRect(), headerRect: header.getBoundingClientRect(), rows, sourceRect: sourceBox.getBoundingClientRect(), target: targetText.textContent, targetRect: targetText.getBoundingClientRect(), targetBoxRect: targetBox.getBoundingClientRect(), marker: [...document.querySelectorAll('.joint-link text')].map((text: Element): string | null => text.textContent) };
  });
}

function fitsOrIsEllipsized(shown: string | null, full: string): boolean { return shown === full || (shown?.endsWith('…') === true && full.startsWith(shown.slice(0, -1))); }
async function verifyText(expectedHeading: string, expectedMembers: readonly string[], expectedTarget: string): Promise<void> {
  const actual = await inspectDiagramText();
  assert.ok(fitsOrIsEllipsized(actual.heading, expectedHeading), 'heading is complete or ellipsized');
  assert.equal(actual.rows.length, expectedMembers.length, 'each source line has exactly one visual line');
  for (const [index, expected] of expectedMembers.entries()) {
    const row = actual.rows[index];
    if (row === undefined) throw new Error('Expected text row.');
    assert.ok(fitsOrIsEllipsized(row.text, expected), `source line ${index + 1} is complete or ellipsized`);
    assert.ok(row.rect.left >= actual.sourceRect.left && row.rect.right <= actual.sourceRect.right, `source line ${index + 1} fits`);
  }
  assert.ok(fitsOrIsEllipsized(actual.target, expectedTarget), 'target name is complete or ellipsized');
  assert.ok(actual.headingRect.left >= actual.headerRect.left && actual.headingRect.right <= actual.headerRect.right, 'heading fits');
  assert.ok(actual.targetRect.left >= actual.targetBoxRect.left && actual.targetRect.right <= actual.targetBoxRect.right, 'target fits');
  assert.deepEqual(actual.marker, ['classes', '*']);
}

export function registerTextEllipsisCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    await verifyText('ClassDiagram', ['addClass', 'addPartialClass', 'connectClasses', 'recalcLayout'], 'Class');
    const heading = 'VeryWideClassDiagramNameWithManyCharacters';
    const member = 'anExtremelyLongMethodNameWithArguments(name: string)';
    const target = 'AnotherVeryLongTargetClassName';
    await page.getByRole('textbox', { name: 'Diagram text' }).fill(`${heading}\n  ${member}\nOWNS classes: ${target}[]`);
    await page.waitForFunction((): boolean => document.querySelector('.joint-type-standard-headeredrectangle text')?.textContent?.startsWith('VeryWide') === true);
    assert.ok((await page.getByRole('textbox', { name: 'Diagram text' }).textContent() ?? '').includes(member), 'editor preserves the full source');
    await verifyText(heading, ['anExtremelyLongMethodNameWithArguments'], target);
  });
}
