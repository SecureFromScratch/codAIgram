import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';
import { removeMockBridgeConfig, startMockBridgeWithFolders, stopMockBridge, type RunningMockBridgeT } from '../../support/mock-bridge.js';

type ActualCodeFixtureT = {
  readonly bridge: RunningMockBridgeT;
  readonly className: Locator;
  readonly tooltip: Locator;
  readonly codeBlock: Locator;
};

const CLASS_NAME: string = 'ScrollableSource';
const SOURCE_FILE: string = 'src/scrollable-source.ts';
const WORKSPACE_ROOT: string = resolve('codAIgram-bridge/tests/mock-get-code-project-one');
const CLASS: ClassDetails = {
  name: CLASS_NAME,
  methods: [{ name: 'run', overloads: [[]] }],
  relations: [],
  sourceFile: SOURCE_FILE,
};
const SHORT_SOURCE: string = 'class ScrollableSource {\n  run(): void {}\n}';
const LONG_SOURCE: string = [
  'class ScrollableSource {',
  ...Array.from({ length: 100 }, (_: unknown, index: number) => `  run${String(index)}(): void {}`),
  '}',
].join('\n');

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'keeps long actual-code tooltips open and scrollable with the mouse',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/26 00:00', text: 'Test tooltip pointer persistence, vertical scrolling for long code, and mouse wheel scrolling within the code area.' },
    ],
  },
};

async function showActualCode(source: string): Promise<ActualCodeFixtureT> {
  await setVisualClasses([CLASS]);
  await page.reload();
  const bridge: RunningMockBridgeT = await startMockBridgeWithFolders([
    { name: 'mock-get-code-project-one', uri: pathToFileURL(WORKSPACE_ROOT).href, index: 0 },
  ], 0, [], [{
    projectName: 'mock-project',
    expectedWorkFolders: [WORKSPACE_ROOT.replace(/\\/g, '/')],
    filepath: SOURCE_FILE,
    typeName: CLASS_NAME,
    code: source,
  }]);
  const className: Locator = page.locator(`[data-class-name="${CLASS_NAME}"] text[joint-selector="headerText"], [data-class-name="${CLASS_NAME}"] text[joint-selector="label"]`);
  try {
    await page.evaluate(async (connectionUrl: string) => {
      const app: { connectToVscodeBridge?: (url: string) => Promise<void> } | undefined =
        (window as Window & { __app?: { connectToVscodeBridge?: (url: string) => Promise<void> } }).__app;
      const connect: ((url: string) => Promise<void>) | undefined = app?.connectToVscodeBridge;
      if (!connect) throw new Error('The development bridge connection hook is unavailable.');
      await connect(connectionUrl);
    }, bridge.connectionUrl);
    await page.waitForFunction(() => (window as Window & { __app?: { isVscodeBridgeConnected?: () => boolean } }).__app?.isVscodeBridgeConnected?.() === true);
    await className.waitFor();
    await className.click({ button: 'right' });
    const showCodeOption: Locator = page.getByRole('menu', { name: 'Class actions' })
      .getByRole('menuitemcheckbox', { name: 'Show actual code' });
    await showCodeOption.click();
    assert.equal(await showCodeOption.getAttribute('aria-checked'), 'true');

    await page.mouse.move(2, 2);
    await className.hover();
    const tooltip: Locator = page.getByRole('tooltip');
    const codeBlock: Locator = tooltip.locator('pre.actual-code-snippet');
    await codeBlock.waitFor();
    await page.waitForFunction((expectedSource: string) => document.querySelector('pre.actual-code-snippet')?.textContent === expectedSource, source);
    return { bridge, className, tooltip, codeBlock };
  } catch (error: unknown) {
    await page.reload();
    await stopMockBridge(bridge.process);
    removeMockBridgeConfig(bridge.configPath);
    throw error;
  }
}

async function cleanupActualCode(bridge: RunningMockBridgeT): Promise<void> {
  await page.reload();
  await stopMockBridge(bridge.process);
  removeMockBridgeConfig(bridge.configPath);
}

export function registerActualCodeScrollCases(): void {
  test('keeps the code tooltip visible while the pointer moves within its bounds', async () => {
    const fixture: ActualCodeFixtureT = await showActualCode(SHORT_SOURCE);
    try {
      const bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null = await fixture.tooltip.boundingBox();
      assert.ok(bounds, 'the code tooltip has visible bounds');
      await page.mouse.move(bounds.x + Math.min(12, bounds.width / 4), bounds.y + Math.min(12, bounds.height / 4));
      await fixture.tooltip.waitFor({ state: 'visible' });
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await fixture.tooltip.waitFor({ state: 'visible' });
      assert.equal(await fixture.codeBlock.textContent(), SHORT_SOURCE);
    } finally {
      await cleanupActualCode(fixture.bridge);
    }
  });

  test('shows a vertical scrollbar when the actual-code snippet is long', async () => {
    const fixture: ActualCodeFixtureT = await showActualCode(LONG_SOURCE);
    try {
      const scrollState: { readonly overflowY: string; readonly scrollHeight: number; readonly clientHeight: number } =
        await fixture.codeBlock.evaluate((element: HTMLElement) => ({
          overflowY: getComputedStyle(element).overflowY,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }));
      assert.ok(scrollState.overflowY === 'auto' || scrollState.overflowY === 'scroll', `code area has vertical scrolling enabled (overflow-y=${scrollState.overflowY})`);
      assert.ok(scrollState.scrollHeight > scrollState.clientHeight, 'long code overflows the visible code area and exposes its scrollbar');
    } finally {
      await cleanupActualCode(fixture.bridge);
    }
  });

  test('scrolls the actual-code scrollbar with the mouse wheel', async () => {
    const fixture: ActualCodeFixtureT = await showActualCode(LONG_SOURCE);
    try {
      const bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null = await fixture.codeBlock.boundingBox();
      assert.ok(bounds, 'the code area has visible bounds');
      const startScrollTop: number = await fixture.codeBlock.evaluate((element: HTMLElement) => element.scrollTop);
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + Math.min(30, bounds.height / 2));
      await page.mouse.wheel(0, 240);
      await page.waitForFunction((previousScrollTop: number) => {
        const element: Element | null = document.querySelector('pre.actual-code-snippet');
        return element instanceof HTMLElement && element.scrollTop > previousScrollTop;
      }, startScrollTop);
      const endScrollTop: number = await fixture.codeBlock.evaluate((element: HTMLElement) => element.scrollTop);
      assert.ok(endScrollTop > startScrollTop, 'mouse wheel input scrolls the code area');
    } finally {
      await cleanupActualCode(fixture.bridge);
    }
  });

  test('drags the actual-code scrollbar thumb with the mouse', async () => {
    const fixture: ActualCodeFixtureT = await showActualCode(LONG_SOURCE);
    try {
      const bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null = await fixture.codeBlock.boundingBox();
      assert.ok(bounds, 'the code area has visible bounds');
      const metrics: { readonly clientHeight: number; readonly scrollHeight: number; readonly scrollTop: number } =
        await fixture.codeBlock.evaluate((element: HTMLElement) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop,
        }));
      assert.ok(metrics.scrollHeight > metrics.clientHeight, 'the code area has a scrollbar');
      const thumbHeight: number = Math.max(12, metrics.clientHeight * metrics.clientHeight / metrics.scrollHeight);
      const scrollbarX: number = bounds.x + bounds.width - 4;
      const thumbCenterY: number = bounds.y + thumbHeight / 2;
      await page.mouse.move(scrollbarX, thumbCenterY);
      await page.mouse.down();
      await page.mouse.move(scrollbarX, bounds.y + bounds.height - thumbHeight / 2, { steps: 6 });
      await page.mouse.up();
      const endScrollTop: number = await fixture.codeBlock.evaluate((element: HTMLElement) => element.scrollTop);
      assert.ok(endScrollTop > metrics.scrollTop, 'dragging the scrollbar thumb scrolls the code area');
    } finally {
      await cleanupActualCode(fixture.bridge);
    }
  });
}
