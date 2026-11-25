import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Locator } from 'playwright';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses, VISUAL_CLASSES } from '../../test-support.js';
import { resetOwnershipEditor } from '../../support/editor-support.js';

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'keeps a class fixed on screen when showing or hiding it in the editor',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 23:42', text: 'Clicking a graph class to show or hide its source in the editor must not move its screen position.' },
      { when: '2026/11/16 01:00', text: 'Use at least 10 classes, including connectors, to verify graph position remains fixed when class visibility changes.' },
    ],
  },
};

export function registerClickSingleClassPositionCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(VISUAL_CLASSES.map((item) => item.name === 'ClassDiagram' ? {
      name: 'AClassDiagram',
      methods: item.methods,
      relations: item.relations,
    } : item));
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> = await resetOwnershipEditor('AClassDiagram');
    const target: Locator = page.locator('[data-class-name="Class"]');
    const box: Locator = target.locator('rect').first();
    const original: Awaited<ReturnType<Locator['boundingBox']>> = await box.boundingBox();
    assert.ok(original);
    await target.click();
    await page.waitForFunction(() => Boolean(document.querySelector('[data-class-name="Class"] [data-eye-badge]')));
    assert.equal((await editor.locator('.cm-line').allTextContents()).join('\n'), `${text}\n\nClass`);
    const shown: Awaited<ReturnType<Locator['boundingBox']>> = await box.boundingBox();
    assert.ok(shown);
    assert.ok(Math.abs(shown.x - original.x) < 1 && Math.abs(shown.y - original.y) < 1, 'showing the class must not move it on screen');
    await target.click();
    await page.waitForFunction(() => !document.querySelector('[data-class-name="Class"] [data-eye-badge]'));
    assert.equal((await editor.locator('.cm-line').allTextContents()).join('\n'), text);
    const hidden: Awaited<ReturnType<Locator['boundingBox']>> = await box.boundingBox();
    assert.ok(hidden);
    assert.ok(Math.abs(hidden.x - original.x) < 1 && Math.abs(hidden.y - original.y) < 1, 'hiding the class must not move it on screen');
  });
}
