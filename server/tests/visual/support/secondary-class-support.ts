import type { Locator } from 'playwright';
import { page } from '../test-support.ts';
import { resetOwnershipEditor } from './editor-support.ts';

export type SecondaryClassFixtureT = {
  readonly name: string;
  readonly source: string;
  readonly members: readonly string[];
};

export type SecondaryClassIsolationT = {
  readonly editor: Locator;
  readonly selected: SecondaryClassFixtureT;
};

export const SECONDARY_CLASSES: readonly SecondaryClassFixtureT[] = [
  { name: 'Modification', source: 'Modification\n  by: string\n  at: datetime', members: ['by: string', 'at: datetime'] },
  { name: 'ModificationHistory', source: 'ModificationHistory\n  modifications : Modification[]\n  push(newModification: Modification)\n  compact(maxModsToKeep: positive)', members: ['modifications : Modification[]', 'push', 'compact'] }
];

export function getSecondaryClassFixture(name: string): SecondaryClassFixtureT {
  const fixture = SECONDARY_CLASSES.find((item: SecondaryClassFixtureT): boolean => item.name === name);
  if (fixture === undefined) throw new Error(`No secondary class fixture named ${name}.`);
  return fixture;
}

export async function isolateSecondaryClass(name: string): Promise<SecondaryClassIsolationT> {
  const { editor, text } = await resetOwnershipEditor();
  await editor.fill(`${text}\n\n${SECONDARY_CLASSES.map((item: SecondaryClassFixtureT): string => item.source).join('\n\n')}`);
  const target = page.locator(`[data-class-name="${name}"]`);
  await target.waitFor();
  await target.dblclick();
  const selected = getSecondaryClassFixture(name);
  await page.waitForFunction((expected: string): boolean => [...document.querySelectorAll('.cm-content .cm-line')].map((line: Element): string | null => line.textContent).join('\n') === expected, selected.source);
  return { editor, selected };
}
