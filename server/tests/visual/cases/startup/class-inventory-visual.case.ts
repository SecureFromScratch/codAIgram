import type { Locator } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isClassDetails, parseClassDetails, type ClassDetails, type ClassMember, type CompositeTypeT, type FieldType } from '@codaigram/shared/class-types';
import { page, setVisualClasses } from '../../test-support.js';
import { logAndThrow, logVisualEvent } from '../../logging.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title: 'shows every supplied class, member, relationship, and selected editor definition',
  prompt: {
    availability: 'available',
    old: 'Using the supplied class inventory, find each class in the visual, check its methods and relationship connectors, and double-click it to check its textual representation.'
  ,
    history: [
      { when: "2026/11/15 09:35", text: "a new test with this content.\nfor each class in the content - find it in the visual.\ncheck that the visual displays its \"methods\" and a connectors for relationships.\ndouble-click it - check that it's textual representation matches." },
    ],
  }
};

function expectedType(type: CompositeTypeT): string {
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) return type.map((value: string) => `'${value}'`).join(' | ');
  return `{ ${Array.from(type, ([name, value]: [string, CompositeTypeT]) => `${name}: ${expectedType(value)}`).join(', ')} }`;
}

function expectedMemberLines(member: ClassMember): string[] {
  const first: FieldType | undefined = member.overloads.at(0)?.at(0);
  if (first?.arg.startsWith('+')) return [`  ${member.name}: ${expectedType(first.t)}`];
  return member.overloads.map((args: FieldType[]) => `  ${member.name}(${args.map((field: FieldType) => `${field.arg}: ${expectedType(field.t)}`).join(', ')})`);
}

function expectedDsl(details: ClassDetails): string {
  return [details.name, ...details.methods.flatMap(expectedMemberLines), ...details.relations.map((relation: ClassDetails['relations'][number]) => `${relation.kind} ${relation.name}: ${relation.target}${relation.many ? '[]' : ''}`)].join('\n');
}

async function checkClass(details: ClassDetails, failures: string[]): Promise<void> {
  await page.reload();
  await page.locator(`[data-class-name="${details.name}"]`).waitFor();
  const box: Locator = page.locator(`[data-class-name="${details.name}"]`);
  try {
    assert.equal(await box.count(), 1, `${details.name}: expected one class box`);
    const boxText: string = await box.textContent() ?? '';
    for (let index: number = 0; index < details.methods.length; index += 1) {
      const member: ClassMember = details.methods[index]!;
      if (!boxText.includes(member.name)) failures.push(`${details.name}: visual box is missing member ${member.name}`);
    }
    for (let index: number = 0; index < details.relations.length; index += 1) {
      const relation: ClassDetails['relations'][number] = details.relations[index]!;
      if (await page.locator(`[data-class-name="${relation.target}"]`).count() !== 1) failures.push(`${details.name}: missing relationship target ${relation.target}`);
      const connector: Locator = page.locator('.joint-link').filter({
        has: page.locator('text').getByText(relation.name, { exact: true }) 
      });
      if (await connector.count() !== 1) failures.push(`${details.name}: missing connector ${relation.name}`);
      else {
        if (await connector.locator('text').getByText('*', { exact: true }).count() !== (relation.many ? 1 : 0)) failures.push(`${details.name}.${relation.name}: incorrect multiplicity`);
        const connected: boolean = await connector.evaluate((element: Element, names: { source: string; target: string; }) => {
          // UNTRUST-ALLOW-NULLISH: The browser SVG query may not find its connector path until rendering completes; returning false avoids dereferencing an absent graphical element.
          const line: SVGPathElement | null = element.querySelector('path[joint-selector="line"]');
          // UNTRUST-ALLOW-NULLISH: The source class element can be absent when the generated graph is incomplete, which is a failed visual assertion rather than a reason to dereference it.
          const source: Element | null = document.querySelector(`[data-class-name="${names.source}"]`);
          // UNTRUST-ALLOW-NULLISH: The target class element can be absent when the generated graph is incomplete, which is a failed visual assertion rather than a reason to dereference it.
          const target: Element | null = document.querySelector(`[data-class-name="${names.target}"]`);
          // UNTRUST-ALLOW-NULLISH: SVG getScreenCTM can return null for detached or non-rendered paths; this check treats such a connector as not connected.
          const transform: DOMMatrix | null = line?.getScreenCTM() ?? null;
          if (!line || !source || !target || !transform) return false;
          const start: DOMPoint = line.getPointAtLength(0).matrixTransform(transform);
          const end: DOMPoint = line.getPointAtLength(line.getTotalLength()).matrixTransform(transform);
          const near: (point: DOMPoint, box: DOMRect) => boolean = (point, box) => point.x >= box.left - 20 && point.x <= box.right + 20 && point.y >= box.top - 20 && point.y <= box.bottom + 20;
          return near(start, source.getBoundingClientRect()) && near(end, target.getBoundingClientRect());
        }, { source: details.name, target: relation.target });
        if (!connected) failures.push(`${details.name}.${relation.name}: connector does not join ${relation.target}`);
      }
    }
  } catch (error: unknown) {
    console.error('Visual class check failed:', error);
    logVisualEvent('ERROR', `${details.name}: ${error instanceof Error ? error.message : String(error)}`);
    failures.push(`${details.name} visual: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    await box.dblclick({ timeout: 1500 });
    const expected: string = expectedDsl(details);
    await page.waitForFunction((value: string) => Array.from(document.querySelectorAll('.cm-content .cm-line')).map((line: Element) => line.textContent).join('\n') === value, expected, { timeout: 1500 });
    const actual: string = (await page.locator('.cm-content .cm-line').allTextContents()).join('\n');
    assert.equal(actual, expected);
  } catch (error: unknown) {
    console.error('Visual editor check failed:', error);
    const actual: string = (await page.locator('.cm-content .cm-line').allTextContents()).join('\n');
    logVisualEvent('ERROR', `${details.name} editor mismatch: actual=${JSON.stringify(actual)}; ${error instanceof Error ? error.message : String(error)}`);
    failures.push(`${details.name} editor: expected ${JSON.stringify(expectedDsl(details))}; actual ${JSON.stringify(actual)}`);
  }
}

export function registerClassInventoryVisualCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const data: unknown = JSON.parse(readFileSync('server/tests/visual/fixtures/class-inventory.json', 'utf8'));
    if (!Array.isArray(data) || !data.every(isClassDetails)) return logAndThrow(new Error('Invalid class inventory test fixture.'));
    const classes: ClassDetails[] = data.map((item: unknown) => parseClassDetails(item, logAndThrow));
    await setVisualClasses(classes);
    const failures: string[] = [];
    for (let index: number = 0; index < classes.length; index += 1) {
      await checkClass(classes[index]!, failures);
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  });
}
