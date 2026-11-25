import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Locator } from 'playwright';
import { page, setVisualClasses } from '../../test-support.js';

const MOCK_PROJECT_CLASSES = [
  {
    name: 'Task',
    methods: [],
    relations: [
      { kind: 'REF' as const, name: 'contract', target: 'TaskContract', many: false },
      { kind: 'OWNS' as const, name: 'children', target: 'ChildTask', many: true },
      { kind: 'REF' as const, name: 'assignees', target: 'AssigneeContract', many: true },
    ],
  },
  {
    name: 'TaskContract',
    methods: [],
    relations: [{ kind: 'REF' as const, name: 'task', target: 'Task', many: false }],
  },
  { name: 'ChildTask', methods: [], relations: [] },
  { name: 'AssigneeContract', methods: [], relations: [] },
  { name: 'Unrelated', methods: [], relations: [] },
];

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; history: { when: string; text: string }[] };
} = {
  title: 'shows the full connected chain when the selected class has only incoming relations',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'Add a visual test for Show Chain starting at a mock-project class that is only connected by incoming relations. Verify the selected class is first and every connected class appears.' },
    ],
  },
};

export function registerShowChainIncomingOnlyCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(MOCK_PROJECT_CLASSES);
    await page.reload();
    const selectedClass: Locator = page.locator('[data-class-name="AssigneeContract"]');
    await selectedClass.waitFor();

    const namesFromModel: string[] = await page.evaluate(() => {
      const app: { getClassChain?: (name: string) => readonly { name: string }[] } | undefined =
        (window as Window & { __app?: { getClassChain?: (name: string) => readonly { name: string }[] } }).__app;
      return app?.getClassChain?.('AssigneeContract').map((details) => details.name) ?? [];
    });
    assert.deepEqual(namesFromModel, ['AssigneeContract', 'Task', 'TaskContract', 'ChildTask']);

    await selectedClass.click({ button: 'right' });
    const menu: Locator = page.getByRole('menu', { name: 'Class actions' });
    await menu.waitFor();
    await menu.getByRole('menuitem', { name: 'Edit chain' }).click();

    await page.waitForFunction(() => document.querySelector('.cm-content')?.textContent?.includes('TaskContract') === true);
    const editorLines: string[] = await page.locator('.cm-line').allTextContents();
    const displayedClasses: string[] = editorLines
      .map((line: string) => line.trim())
      .filter((line: string) => ['AssigneeContract', 'Task', 'TaskContract', 'ChildTask', 'Unrelated'].includes(line));
    assert.equal(displayedClasses[0], 'AssigneeContract');
    assert.deepEqual(new Set(displayedClasses), new Set(['AssigneeContract', 'Task', 'TaskContract', 'ChildTask']));
  });
}
