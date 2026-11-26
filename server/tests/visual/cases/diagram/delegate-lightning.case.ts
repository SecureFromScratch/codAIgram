import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';

const DELEGATE_NAME: string = 'BridgeSocketFactory';
const OWNER_NAME: string = 'BridgeClient';
const CLASSES: readonly ClassDetails[] = [
  {
    name: DELEGATE_NAME,
    state: 'delegate',
    methods: [{
      name: '',
      overloads: [[{ arg: '+RET', t: 'BridgeSocket' }, { arg: 'url', t: 'string' }, { arg: 'origin', t: 'string' }]],
    }],
    relations: [],
  },
  {
    name: OWNER_NAME,
    methods: [
      { name: 'connect', overloads: [[{ arg: 'factory', t: DELEGATE_NAME }]] },
      { name: 'on', overloads: [[{ arg: 'callback', t: '(value: string) => void' }]] },
    ],
    relations: [],
  },
];

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'marks delegates and function-typed arguments with a lightning emoji',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test: delegate names get a ⚡ suffix and arguments accepting a function type get ⚡ before the argument type.' },
    ],
  },
};

export function registerDelegateLightningCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();

    const delegateHeader: Locator = page.locator(`[data-class-name="${DELEGATE_NAME}"] text[joint-selector="label"], [data-class-name="${DELEGATE_NAME}"] text[joint-selector="headerText"]`);
    await delegateHeader.waitFor();
    assert.match(await delegateHeader.textContent() ?? '', /⚡/u);

    await page.locator(`[data-class-name="${OWNER_NAME}"] [data-method-tooltip*="factory:"]`).hover();
    const tooltip: Locator = page.getByRole('tooltip');
    await tooltip.waitFor();
    assert.equal(await tooltip.locator('.tooltip-type').textContent(), '⚡BridgeSocketFactory');
    await page.locator(`[data-class-name="${OWNER_NAME}"] [data-method-tooltip*="callback:"]`).hover();
    assert.equal(await tooltip.locator('.tooltip-type').textContent(), '⚡(value: string) => void');
  });
}
