import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import { page, setVisualClasses } from '../../test-support.js';
import { removeMockBridgeConfig, startMockBridgeWithFolders, stopMockBridge } from '../../support/mock-bridge.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'shares the Show actual code setting across classboxes',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/26 00:00', text: 'Verify that Show actual code is shared across classboxes and controls each class source tooltip.' },
    ],
  },
};

const CLASSES: readonly ClassDetails[] = [
  { name: 'CodeAlpha', methods: [{ name: 'alpha', overloads: [[]] }], relations: [], sourceFile: 'src/code-alpha.ts' },
  { name: 'CodeBeta', methods: [{ name: 'beta', overloads: [[]] }], relations: [], sourceFile: 'src/code-beta.ts' },
];
const WORKSPACE_ROOT: string = resolve('codAIgram-bridge/tests/mock-get-code-project-one');
const CODE_ALPHA: string = 'class CodeAlpha { alpha(): void {} }';
const CODE_BETA: string = 'class CodeBeta { beta(): void {} }';

export function registerClassNameContextMenuToggleActualCodeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();
    const mock = await startMockBridgeWithFolders([
      { name: 'mock-get-code-project-one', uri: pathToFileURL(WORKSPACE_ROOT).href, index: 0 },
    ], 0, [], [
      { projectName: 'mock-project', expectedWorkFolders: [WORKSPACE_ROOT.replace(/\\/g, '/')], filepath: 'src/code-alpha.ts', typeName: 'CodeAlpha', code: CODE_ALPHA },
      { projectName: 'mock-project', expectedWorkFolders: [WORKSPACE_ROOT.replace(/\\/g, '/')], filepath: 'src/code-beta.ts', typeName: 'CodeBeta', code: CODE_BETA },
    ]);
    try {
      await page.evaluate(async (connectionUrl: string) => {
        const app: { connectToVscodeBridge?: (url: string) => Promise<void> } | undefined =
          (window as Window & { __app?: { connectToVscodeBridge?: (url: string) => Promise<void> } }).__app;
        const connect: ((url: string) => Promise<void>) | undefined = app?.connectToVscodeBridge;
        if (!connect) throw new Error('The development bridge connection hook is unavailable.');
        await connect(connectionUrl);
      }, mock.connectionUrl);
      await page.waitForFunction(() => (window as Window & { __app?: { isVscodeBridgeConnected?: () => boolean } }).__app?.isVscodeBridgeConnected?.() === true);

      const alphaName: Locator = page.locator('[data-class-name="CodeAlpha"] text[joint-selector="headerText"]');
      const betaName: Locator = page.locator('[data-class-name="CodeBeta"] text[joint-selector="headerText"]');
      await alphaName.waitFor();
      await betaName.waitFor();
      const openMenu: (name: Locator) => Promise<Locator> = async (name: Locator) => {
        await name.click({ button: 'right' });
        const menu: Locator = page.getByRole('menu', { name: 'Class actions' });
        await menu.waitFor();
        return menu.getByRole('menuitemcheckbox', { name: 'Show actual code' });
      };
      const alphaOption: Locator = await openMenu(alphaName);
      assert.equal(await alphaOption.getAttribute('aria-checked'), 'false');
      await alphaOption.click();
      assert.equal(await alphaOption.getAttribute('aria-checked'), 'true');

      const betaOption: Locator = await openMenu(betaName);
      assert.equal(await betaOption.getAttribute('aria-checked'), 'true');
      await betaName.hover();
      const betaTooltip: Locator = page.getByRole('tooltip');
      await betaTooltip.locator('pre.actual-code-snippet').waitFor();
      assert.equal(await betaTooltip.locator('pre.actual-code-snippet').textContent(), CODE_BETA);

      await betaOption.click();
      assert.equal(await betaOption.getAttribute('aria-checked'), 'false');
      await alphaName.hover();
      const alphaTooltip: Locator = page.getByRole('tooltip');
      await alphaTooltip.waitFor();
      assert.equal(await alphaTooltip.locator('pre.actual-code-snippet').count(), 0);
      assert.equal(await alphaTooltip.locator('hr').count(), 0);

      const alphaOptionAfterToggle: Locator = await openMenu(alphaName);
      assert.equal(await alphaOptionAfterToggle.getAttribute('aria-checked'), 'false');
    } finally {
      await page.reload();
      await stopMockBridge(mock.process);
      removeMockBridgeConfig(mock.configPath);
    }
  });
}
