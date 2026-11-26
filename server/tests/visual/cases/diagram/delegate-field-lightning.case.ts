import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { test } from 'node:test';
import type { ClassDetails } from '../../../../dist/memory-repository.js';
import type { TestCaseMetadata } from '../../../test-case-metadata.js';
import { page, setVisualClasses } from '../../test-support.js';

const OWNER_CLASS: string = 'FactoryOwner';
const DELEGATE_NAME: string = 'SocketFactory';
const CLASSES: readonly ClassDetails[] = [
  {
    name: OWNER_CLASS,
    methods: [
      {
        name: 'factory',
        overloads: [[{ arg: '+RO', t: DELEGATE_NAME }]],
      },
    ],
    relations: [],
  },
  {
    name: DELEGATE_NAME,
    state: 'delegate',
    methods: [
      {
        name: '',
        overloads: [[{ arg: '+RET', t: 'Socket' }]],
      },
    ],
    relations: [],
  },
];

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'prefixes delegate-typed member fields with a lightning emoji',
  prompt: {
    availability: 'available',
    history: [
      {
        when: '2026/11/25 00:00',
        text: 'Add a visual test: a member field whose type is a delegate displays the lightning emoji before the field name in the classbox members panel.',
      },
    ],
  },
};

export function registerDelegateFieldLightningCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();

    const owner: Locator = page.locator(`[data-class-name="${OWNER_CLASS}"]`);
    await owner.waitFor();
    const body: Locator = owner.locator('text[joint-selector="bodyText"]');
    const renderedText: string = await body.textContent() ?? '';
    assert.match(renderedText, /^\s*\u{26A1}factory:\s*SocketFactory/u);
  });
}
