import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Locator } from "playwright";
import { page, setVisualClasses } from "../../test-support.js";
import type { ClassDetails } from "../../../../dist/memory-repository.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: 'keeps class positions and graph scroll when toggling classes in a large connected diagram',
  prompt: {
    availability: 'available',
    history: [
      { when: "2026/11/15 23:42", text: "add a visual test - clicking on a class (making it visible or not in the text editor) does not move the graph view (that clicked grpah remains in the same screen position)." },
      { when: "2026/11/16 01:00", text: "i think this is not tested, or if it is then not with enough classes. use at least 10 classes, with some having connectors. you can base this on the mock-project's structure.: add a visual test - clicking on a class (making it visible or not in the text editor) does not move the graph view (that clicked grpah remains in the same screen position)." },
    ],
  },
};

const LARGE_CLASSES: readonly ClassDetails[] = [
  { 
    name: 'AssigneeContract', 
    methods: [{ name: 'assign', overloads: [[]] }], 
    relations: [], 
  },
  { 
    name: 'ChildTask', 
    methods: [], 
    relations: [], 
    state: 'partial' 
  },
  { 
    name: 'Queue', 
    methods: [{ name: 'push', overloads: [[]] }], 
    relations: [], 
  },
  { 
    name: 'Task', 
    methods: [{ name: 'assign', overloads: [[]] }], 
    relations: [
    { 
      kind: 'UNK', 
      name: 'contract', 
      target: 'TaskContract', 
      many: false 
    },
    { 
      kind: 'UNK', 
      name: 'children', 
      target: 'ChildTask', 
      many: true 
    },
    { 
      kind: 'UNK', 
      name: 'assignees', 
      target: 'AssigneeContract', 
      many: true 
    },
  ], 
  },
  { 
    name: 'TaskContract', 
    methods: [{ name: 'describe', overloads: [[]] }], 
    relations: [{ kind: 'UNK', name: 'task', target: 'Task', many: false }], 
  },
  { 
    name: 'TaskAudit', 
    methods: [{ name: 'record', overloads: [[]] }], 
    relations: [{ kind: 'REF', name: 'task', target: 'Task', many: false }], 
  },
  { name: 'UnusedError', methods: [], relations: [], },
  { name: 'DerivedError', methods: [], relations: [], },
  { name: 'ThrownError', methods: [], relations: [], },
  { name: 'LoggedError', methods: [], relations: [], },
  { name: 'VariableError', methods: [], relations: [], },
  { name: 'ThrownValue', methods: [], relations: [], },
];

export function registerClickPositionCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(LARGE_CLASSES);
    await page.reload();
    await page.locator('[data-class-name="Task"]').waitFor();
    assert.equal(await page.locator('[data-class-name]').count(), LARGE_CLASSES.length);
    assert.ok(await page.locator('.joint-link').count() >= 4);
    const classNames: readonly string[] = ['Task', 'TaskContract', 'ThrownValue'];
    const visibilitySequence: readonly boolean[] = [true, false];
    const verifyPositionForClass: (name: string) => Promise<void> = async (name: string) => {
      const box: Locator = page.locator(`[data-class-name="${name}"] rect`).first();
      await box.scrollIntoViewIfNeeded();
      const original: Awaited<ReturnType<Locator['boundingBox']>> = await box.boundingBox();
      assert.ok(original);
      const scroll: { left: number; top: number } = await page.locator('.canvas').evaluate((element: HTMLElement) => ({ left: element.scrollLeft, top: element.scrollTop }));
      const verifyVisibility: (visible: boolean) => Promise<void> = async (visible: boolean) => {
        await page.locator(`[data-class-name="${name}"]`).click();
        await page.waitForFunction(({ className, expected }) => Boolean(document.querySelector(`[data-class-name="${className}"] [data-eye-badge]`)) === expected, { className: name, expected: visible });
        const current: Awaited<ReturnType<Locator['boundingBox']>> = await box.boundingBox();
        assert.ok(current);
        assert.ok(Math.abs(current.x - original.x) < 1 && Math.abs(current.y - original.y) < 1, `${name} moved after visibility toggle`);
        assert.deepEqual(await page.locator('.canvas').evaluate((element: HTMLElement) => ({ left: element.scrollLeft, top: element.scrollTop })), scroll);
      };
      const visibilityChecks: Promise<void> = visibilitySequence.reduce<Promise<void>>(
        async (previous: Promise<void>, visible: boolean) => {
          await previous;
          await verifyVisibility(visible);
        },
        Promise.resolve(),
      );
      await visibilityChecks;
    };
    const positionChecks: Promise<void> = classNames.reduce<Promise<void>>(
      async (previous: Promise<void>, name: string) => {
        await previous;
        await verifyPositionForClass(name);
      },
      Promise.resolve(),
    );
    await positionChecks;
  });
}
