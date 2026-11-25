import assert from 'node:assert/strict';
import { test } from 'node:test';
import { page } from '../../test-support.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { diagramBounds, type PanelBoundsT } from './diagram-fullscreen-support.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'restores the diagram panel to its original size',
  prompt: {
    availability: 'available',
    history: [{ when: '2026/11/18 09:35', text: 'Clicking the diagram fullscreen control toggles between the current panel layout and fullscreen.' }],
  },
};

export function registerDiagramFullscreenRestoreCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await page.getByRole('button', { name: 'Expand diagram to full screen' }).click();
    await page.getByRole('button', { name: 'Exit full screen diagram' }).click();
    await page.getByRole('button', { name: 'Expand diagram to full screen' }).waitFor();
    const bounds: PanelBoundsT = await diagramBounds();
    assert.ok(bounds.left > 0);
    assert.ok(bounds.top > 0);
    assert.ok(bounds.width < bounds.viewportWidth);
    assert.ok(bounds.height < bounds.viewportHeight);
    assert.equal(await page.locator('.text-pane').isVisible(), true);
  });
}
