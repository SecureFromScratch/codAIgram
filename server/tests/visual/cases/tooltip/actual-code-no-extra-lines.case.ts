import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';
import { removeMockBridgeConfig, startMockBridgeWithFolders, stopMockBridge } from '../../support/mock-bridge.js';

const CLASS_NAME: string = 'CompactSource';
const WORKSPACE_ROOT: string = resolve('codAIgram-bridge/tests/mock-get-code-project-one');
const ACTUAL_SOURCE: string = ['class CompactSource {', '  run(): void {}', '}'].join('\n');
const CLASS: ClassDetails = {
  name: CLASS_NAME,
  methods: [{ name: 'run', overloads: [[]] }],
  relations: [],
  sourceFile: 'src/compact-source.ts',
};

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'does not add blank visual lines to unwrapped actual source code',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/26 00:00', text: 'Verify that the Show actual code tooltip renders compact source lines without adding empty visual lines when no wrapping is needed.' },
    ],
  },
};

export function registerActualCodeNoExtraLinesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([CLASS]);
    await page.reload();

    const mockBridge = await startMockBridgeWithFolders([
      { name: 'mock-get-code-project-one', uri: pathToFileURL(WORKSPACE_ROOT).href, index: 0 },
    ], 0, [], [{
      projectName: 'mock-project',
      expectedWorkFolders: [WORKSPACE_ROOT.replace(/\\/g, '/')],
      filepath: CLASS.sourceFile ?? '',
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

      const className: Locator = page.locator(`[data-class-name="${CLASS_NAME}"] text[joint-selector="headerText"]`);
      await className.waitFor();
      await className.click({ button: 'right' });
      const actualCodeOption: Locator = page.getByRole('menu', { name: 'Class actions' })
        .getByRole('menuitemcheckbox', { name: 'Show actual code' });
      assert.equal(await actualCodeOption.getAttribute('aria-checked'), 'false');
      await actualCodeOption.click();
      assert.equal(await actualCodeOption.getAttribute('aria-checked'), 'true');

      await page.mouse.move(0, 0);
      await className.hover();
      const codeBlock: Locator = page.getByRole('tooltip').locator('pre.actual-code-snippet');
      await codeBlock.waitFor();
      assert.equal(await codeBlock.textContent(), ACTUAL_SOURCE);
      const layout: { readonly clientHeight: number; readonly lineHeight: number; readonly renderedLineCount: number } =
        await codeBlock.evaluate((element: HTMLElement) => ({
          clientHeight: element.clientHeight,
          lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
          renderedLineCount: element.querySelectorAll('.actual-code-line').length,
        }));
      assert.equal(layout.renderedLineCount, ACTUAL_SOURCE.split('\n').length);
      assert.ok(Number.isFinite(layout.lineHeight) && layout.lineHeight > 0);
      assert.ok(
        layout.clientHeight <= layout.renderedLineCount * layout.lineHeight + 1,
        `unwrapped source should occupy one visual line per source line (height=${layout.clientHeight}, expected=${layout.renderedLineCount * layout.lineHeight})`,
      );
    } finally {
      await page.reload();
      await stopMockBridge(mockBridge.process);
      removeMockBridgeConfig(mockBridge.configPath);
    }
  });
}
