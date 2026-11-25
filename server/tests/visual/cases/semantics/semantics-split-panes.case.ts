import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Locator } from 'playwright';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page } from '../../test-support.js';

type PanePositionT = { x: number; y: number };
type PanePositionProbeT = (element: HTMLElement) => PanePositionT;

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'splits the Semantics page into Glossary and References panes',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/23 09:35', text: 'Add a visual test that verifies the Semantics page has side-by-side Glossary and References panes.' },
    ],
  },
};

export function registerSemanticsSplitPanesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await page.getByRole('tab', { name: 'Semantics' }).click();

    const glossaryPane: Locator = page.locator('.semantics-glossary-pane');
    const referencesPane: Locator = page.locator('.semantics-references-pane');
    assert.equal(await page.getByRole('heading', { name: 'Glossary', level: 2 }).isVisible(), true);
    assert.equal(await page.getByRole('heading', { name: 'References', level: 2 }).isVisible(), true);
    assert.equal(await glossaryPane.count(), 1);
    assert.equal(await referencesPane.count(), 1);

    const measurePanePosition: PanePositionProbeT = (element) => {
      const bounds: DOMRect = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y };
    };
    const glossaryPosition: PanePositionT = await glossaryPane.evaluate(measurePanePosition);
    const referencesPosition: PanePositionT = await referencesPane.evaluate(measurePanePosition);
    assert.ok(glossaryPosition.x < referencesPosition.x, 'Glossary should be to the left of References.');
    assert.equal(glossaryPosition.y, referencesPosition.y, 'Both panes should share the same top edge.');
  });
}
