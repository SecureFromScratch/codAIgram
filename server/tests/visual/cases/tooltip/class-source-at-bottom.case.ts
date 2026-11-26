import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses, VISUAL_CLASSES } from '../../test-support.js';
import { removeMockBridgeConfig, startMockBridgeWithFolders, stopMockBridge } from '../../support/mock-bridge.js';

const CLASS_NAME: string = 'ClassDiagram';
const SOURCE_FILE: string = 'src/class-diagram.ts';
const WORKSPACE_ROOT: string = resolve('codAIgram-bridge/tests/mock-get-code-project-one');
const ACTUAL_SOURCE: string = [
  'class ClassDiagram {',
  '  addClass(name: string): void {',
  '    console.log(name);',
  '  }',
  '}',
].join('\n');
const CLASSES: readonly ClassDetails[] = VISUAL_CLASSES.map((item: ClassDetails) => item.name === CLASS_NAME
  ? { ...item, sourceFile: SOURCE_FILE, modifiedAt: '2026-11-26T09:35:00.000Z' }
  : item);

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'keeps the actual code tooltip visible when its classbox is at the bottom of the screen',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/26 00:00', text: 'Enable Show actual code, hover a classbox at the bottom of the screen, and verify the code tooltip is positioned without clipping its content.' },
    ],
  },
};

export function registerClassSourceAtBottomCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await page.setViewportSize({ width: 1600, height: 440 });
    try {
      await setVisualClasses(CLASSES);
      await page.reload();
      const mockBridge = await startMockBridgeWithFolders([
        { name: 'mock-get-code-project-one', uri: pathToFileURL(WORKSPACE_ROOT).href, index: 0 },
      ], 0, [], [{
        projectName: 'mock-project',
        expectedWorkFolders: [WORKSPACE_ROOT.replace(/\\/g, '/')],
        filepath: SOURCE_FILE,
        typeName: CLASS_NAME,
        code: ACTUAL_SOURCE,
      }]);
      try {
        await page.evaluate(async (connectionUrl: string) => {
          const app: { connectToVscodeBridge?: (url: string) => Promise<void> } | undefined =
            (window as Window & { __app?: { connectToVscodeBridge?: (url: string) => Promise<void> } }).__app;
          const connect: ((url: string) => Promise<void>) | undefined = app?.connectToVscodeBridge;
          if (!connect) throw new Error('The development bridge connection hook is unavailable.');
          await connect(connectionUrl);
        }, mockBridge.connectionUrl);
        await page.waitForFunction(() => (window as Window & { __app?: { isVscodeBridgeConnected?: () => boolean } }).__app?.isVscodeBridgeConnected?.() === true);

        const canvas: Locator = page.locator('.canvas');
        const box: Locator = page.locator(`[data-class-name="${CLASS_NAME}"]`);
        await box.waitFor();
        await box.locator('text[joint-selector="headerText"], text[joint-selector="label"]').click({ button: 'right' });
        const showActualCode: Locator = page.getByRole('menu', { name: 'Class actions' })
          .getByRole('menuitemcheckbox', { name: 'Show actual code' });
        assert.equal(await showActualCode.getAttribute('aria-checked'), 'false');
        await showActualCode.click();
        assert.equal(await showActualCode.getAttribute('aria-checked'), 'true');

        await canvas.evaluate((element: HTMLElement) => {
          const classBox: Element | null = element.querySelector('[data-class-name="ClassDiagram"]');
          if (!classBox) throw new Error('Expected the ClassDiagram classbox.');
          const boxBounds: DOMRect = classBox.getBoundingClientRect();
          const panelBounds: DOMRect = element.getBoundingClientRect();
          element.scrollTop += boxBounds.bottom - panelBounds.bottom + 2;
        });

        const className: Locator = box.locator('text[joint-selector="headerText"], text[joint-selector="label"]');
        await page.mouse.move(2, 2);
        await className.hover();
        const tooltip: Locator = page.getByRole('tooltip');
        const codeBlock: Locator = tooltip.locator('pre.actual-code-snippet');
        await codeBlock.waitFor();
        assert.equal(await codeBlock.textContent(), ACTUAL_SOURCE);
        const bounds: {
          readonly top: number;
          readonly bottom: number;
          readonly viewportHeight: number;
          readonly panelTop: number;
          readonly panelBottom: number;
          readonly scrollHeight: number;
          readonly clientHeight: number;
          readonly text: string;
        } = await tooltip.evaluate((element: HTMLElement) => {
          const rectangle: DOMRect = element.getBoundingClientRect();
          const panel: Element | null = element.closest('.graph-pane');
          if (!panel) throw new Error('Expected the tooltip to be inside the graph panel.');
          const panelBounds: DOMRect = panel.getBoundingClientRect();
          return {
            top: rectangle.top,
            bottom: rectangle.bottom,
            viewportHeight: window.innerHeight,
            panelTop: panelBounds.top,
            panelBottom: panelBounds.bottom,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            text: element.innerText,
          };
        });
        assert.ok(bounds.text.includes(CLASS_NAME) && bounds.text.includes(SOURCE_FILE));
        assert.ok(bounds.top >= bounds.panelTop, 'tooltip starts inside the graph panel');
        assert.ok(bounds.bottom <= bounds.panelBottom, 'tooltip ends inside the graph panel');
        assert.ok(bounds.top >= 0 && bounds.bottom <= bounds.viewportHeight, 'tooltip fits inside the screen');
        assert.ok(bounds.scrollHeight <= bounds.clientHeight + 1, 'tooltip content is not clipped');
        const codeBounds: { readonly top: number; readonly bottom: number; readonly viewportHeight: number; readonly scrollHeight: number; readonly clientHeight: number } =
          await codeBlock.evaluate((element: HTMLElement) => {
            const rectangle: DOMRect = element.getBoundingClientRect();
            return {
              top: rectangle.top,
              bottom: rectangle.bottom,
              viewportHeight: window.innerHeight,
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
            };
          });
        assert.ok(codeBounds.top >= 0 && codeBounds.bottom <= codeBounds.viewportHeight, 'actual code is visible inside the screen');
        assert.ok(codeBounds.scrollHeight <= codeBounds.clientHeight + 1, 'actual code is not clipped');
      } finally {
        await page.reload();
        await stopMockBridge(mockBridge.process);
        removeMockBridgeConfig(mockBridge.configPath);
      }
    } finally {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.locator('.canvas').evaluate((element: HTMLElement) => { element.scrollTop = 0; });
      await page.mouse.move(2, 2);
    }
  });
}
