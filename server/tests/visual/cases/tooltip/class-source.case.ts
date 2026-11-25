import type { Locator } from 'playwright';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import { page, setVisualClasses } from '../../test-support.js';
import { removeMockBridgeConfig, startMockBridgeWithFolders, stopMockBridge } from '../../support/mock-bridge.js';

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { 
    availability: string; 
    history: { when: string; text: string }[] 
  };
} = {
  title: 'shows each class source file and modification date when hovering its name',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 23:42', text: 'add a visual test for every modified class - modification date and file the class is defined in appear in tooltip when hovering classname (if thi requires a server api change and stored data change - do those first and modify server tests accordingly)' },
    ],
  },
};

const CLASSES: readonly ClassDetails[] = [
  { 
    name: 'Alpha', 
    methods: [{ name: 'work', overloads: [[]] }], 
    relations: [],  
    sourceFile: 'src/alpha.ts', 
    modifiedAt: '2026-11-15T09:35:00.000Z' 
  },
  { 
    name: 'Beta', 
    methods: [{ name: 'run', overloads: [[]] }], 
    relations: [],  
    sourceFile: 'src/beta.ts', 
    modifiedAt: '2026-11-14T12:00:00.000Z' 
  },
  { 
    name: 'Gamma', 
    methods: [], 
    relations: [], 
    state: 'partial', 
    sourceFile: 'src/gamma.ts', 
    modifiedAt: '2026-11-13T08:15:00.000Z' 
  },
  {
    name: 'SharedType',
    methods: [{ name: 'source', overloads: [[{ arg: '+RO', t: 'string' }]] }],
    relations: [],
    sourceFile: 'src/shared-type.ts',
    modifiedAt: '2026-11-12T08:15:00.000Z',
  },
];

const SHARED_TYPE_ROOT: string = resolve('codAIgram-bridge/tests/mock-get-code-project-one');
const ACTUAL_SOURCE: string = 'class SharedType {\n    public readonly source: string = "one";\n}';

export function registerClassSourceCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();
    const checkClassSource: (item: ClassDetails) => Promise<void> = async (item: ClassDetails) => {
      const name: Locator = page.locator(`[data-class-name="${item.name}"] text[joint-selector="headerText"], [data-class-name="${item.name}"] text[joint-selector="label"]`);
      await name.hover();
      const tooltip: Locator = page.getByRole('tooltip');
      await tooltip.waitFor();
      const text: string = await tooltip.innerText();
      assert.ok(text.includes(item.name));
      assert.ok(item.sourceFile && text.includes(item.sourceFile));
      assert.ok(item.modifiedAt && text.includes(item.modifiedAt));
      assert.equal(await tooltip.locator('hr').count(), 0);
    };
    const classSourceChecks: Promise<void> = CLASSES.reduce<Promise<void>>(
      async (previous: Promise<void>, item: ClassDetails) => {
        await previous;
        await checkClassSource(item);
      },
      Promise.resolve(),
    );
    await classSourceChecks;

    const sharedTypeName: Locator = page.locator('[data-class-name="SharedType"] text[joint-selector="headerText"]');
    await sharedTypeName.click({ button: 'right' });
    const classMenu: Locator = page.getByRole('menu', { name: 'Class actions' });
    await classMenu.getByRole('menuitemcheckbox', { name: 'Show actual code' }).click();
    await sharedTypeName.hover();
    const unavailableTooltip: Locator = page.getByRole('tooltip');
    await unavailableTooltip.getByText('Code unavailable', { exact: true }).waitFor();
    assert.equal(await unavailableTooltip.locator('hr').count(), 1);

    const mock = await startMockBridgeWithFolders([
      { name: 'mock-get-code-project-one', uri: pathToFileURL(SHARED_TYPE_ROOT).href, index: 0 },
    ], 0, [], [{
      projectName: 'mock-project',
      expectedWorkFolders: [SHARED_TYPE_ROOT.replace(/\\/g, '/')],
      filepath: 'src/shared-type.ts',
      typeName: 'SharedType',
      code: ACTUAL_SOURCE,
    }]);
    try {
      await page.evaluate(async (connectionUrl: string) => {
        const app: { connectToVscodeBridge?: (url: string) => Promise<void> } | undefined =
          (window as Window & { __app?: { connectToVscodeBridge?: (url: string) => Promise<void> } }).__app;
        const connect: ((url: string) => Promise<void>) | undefined = app?.connectToVscodeBridge;
        if (!connect) throw new Error('The development bridge connection hook is unavailable.');
        await connect(connectionUrl);
      }, mock.connectionUrl);
      await page.waitForFunction(() => (window as Window & { __app?: { isVscodeBridgeConnected?: () => boolean } }).__app?.isVscodeBridgeConnected?.() === true);
      await page.mouse.move(0, 0);
      await sharedTypeName.hover();
      const tooltip: Locator = page.getByRole('tooltip');
      await tooltip.locator('pre.actual-code-snippet').waitFor();
      assert.equal(await tooltip.locator('hr').count(), 1);
      assert.equal(await tooltip.locator('pre.actual-code-snippet').innerText(), ACTUAL_SOURCE);
    } finally {
      await page.reload();
      await stopMockBridge(mock.process);
      removeMockBridgeConfig(mock.configPath);
    }

  });
}
