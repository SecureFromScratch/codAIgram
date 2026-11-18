import assert from "node:assert/strict";
import { test } from "node:test";
import type { Locator } from "playwright";
import { page, setVisualClasses, VISUAL_CLASSES } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import type { ClassDetails } from "../../../../dist/memory-repository.js";

export const TEST_CASE_METADATA = {
  title: "keeps the clicked class in the same screen position when toggling editor visibility",
  prompt: {
    history: [
      { when: "2026/11/15 23:42", text: "add a visual test - clicking on a class (making it visible or not in the text editor) does not move the graph view (that clicked grpah remains in the same screen position)." },
      { when: "2026/11/16 01:00", text: "i think this is not tested, or if it is then not with enough classes. use at least 10 classes, with some having connectors. you can base this on the mock-project's structure.: add a visual test - clicking on a class (making it visible or not in the text editor) does not move the graph view (that clicked grpah remains in the same screen position)." },
    ],
  },
};

const LARGE_CLASSES: readonly ClassDetails[] = [
  { name: 'AssigneeContract', methods: [{ name: 'assign', overloads: [[]] }], relations: [], },
  { name: 'ChildTask', methods: [], relations: [], state: 'partial' },
  { name: 'Queue', methods: [{ name: 'push', overloads: [[]] }], relations: [], },
  { name: 'Task', methods: [{ name: 'assign', overloads: [[]] }], relations: [
    { kind: 'UNK', name: 'contract', target: 'TaskContract', many: false },
    { kind: 'UNK', name: 'children', target: 'ChildTask', many: true },
    { kind: 'UNK', name: 'assignees', target: 'AssigneeContract', many: true },
  ], },
  { name: 'TaskContract', methods: [{ name: 'describe', overloads: [[]] }], relations: [{ kind: 'UNK', name: 'task', target: 'Task', many: false }], },
  { name: 'TaskAudit', methods: [{ name: 'record', overloads: [[]] }], relations: [{ kind: 'REF', name: 'task', target: 'Task', many: false }], },
  { name: 'UnusedError', methods: [], relations: [], },
  { name: 'DerivedError', methods: [], relations: [], },
  { name: 'ThrownError', methods: [], relations: [], },
  { name: 'LoggedError', methods: [], relations: [], },
  { name: 'VariableError', methods: [], relations: [], },
  { name: 'ThrownValue', methods: [], relations: [], },
];

export function registerClickPositionCase(): void {
  test('keeps class positions and graph scroll when toggling classes in a large connected diagram', async () => {
    await setVisualClasses(LARGE_CLASSES);
    await page.reload();
    await page.locator('[data-class-name="Task"]').waitFor();
    assert.equal(await page.locator('[data-class-name]').count(), LARGE_CLASSES.length);
    assert.ok(await page.locator('.joint-link').count() >= 4);
    for (const name of ['Task', 'TaskContract', 'ThrownValue']) {
      const box: Locator = page.locator(`[data-class-name="${name}"] rect`).first();
      await box.scrollIntoViewIfNeeded();
      const original: Awaited<ReturnType<Locator['boundingBox']>> = await box.boundingBox();
      assert.ok(original);
      const scroll: { left: number; top: number } = await page.locator('.canvas').evaluate((element: HTMLElement) => ({ left: element.scrollLeft, top: element.scrollTop }));
      for (const visible of [true, false]) {
        await page.locator(`[data-class-name="${name}"]`).click();
        await page.waitForFunction(({ className, expected }) => Boolean(document.querySelector(`[data-class-name="${className}"] [data-eye-badge]`)) === expected, { className: name, expected: visible });
        const current: Awaited<ReturnType<Locator['boundingBox']>> = await box.boundingBox();
        assert.ok(current);
        assert.ok(Math.abs(current.x - original.x) < 1 && Math.abs(current.y - original.y) < 1, `${name} moved after visibility toggle`);
        assert.deepEqual(await page.locator('.canvas').evaluate((element: HTMLElement) => ({ left: element.scrollLeft, top: element.scrollTop })), scroll);
      }
    }
  });
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(VISUAL_CLASSES.map((item) => item.name === "ClassDiagram" ? { ...item, name: "AClassDiagram" } : item));
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> = await resetOwnershipEditor("AClassDiagram");
    const target: Locator = page.locator('[data-class-name="Class"]');
    const box: Locator = target.locator("rect").first();
    const original: Awaited<ReturnType<Locator["boundingBox"]>> = await box.boundingBox();
    assert.ok(original);

    await target.click();
    await page.waitForFunction(() => document.querySelector('[data-class-name="Class"] [data-eye-badge]') !== null);
    assert.equal((await editor.locator(".cm-line").allTextContents()).join("\n"), `${text}\n\nClass`);
    const shown: Awaited<ReturnType<Locator["boundingBox"]>> = await box.boundingBox();
    assert.ok(shown);
    assert.ok(Math.abs(shown.x - original.x) < 1 && Math.abs(shown.y - original.y) < 1, "showing the class must not move it on screen");

    await target.click();
    await page.waitForFunction(() => document.querySelector('[data-class-name="Class"] [data-eye-badge]') === null);
    assert.equal((await editor.locator(".cm-line").allTextContents()).join("\n"), text);
    const hidden: Awaited<ReturnType<Locator["boundingBox"]>> = await box.boundingBox();
    assert.ok(hidden);
    assert.ok(Math.abs(hidden.x - original.x) < 1 && Math.abs(hidden.y - original.y) < 1, "hiding the class must not move it on screen");
  });
}
