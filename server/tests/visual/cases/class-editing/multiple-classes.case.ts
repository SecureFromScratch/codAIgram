import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "updates multiple classes and reconnects ownership when a target is renamed",
  prompt: {
    availability: "available",
    text: "Multiple classes are separated by a blank line; editing the second class updates the graph, renaming ownership targets reconnects the relation, and duplicate names or missing separators report diagnostics.",
  },
};
export function registerMultipleClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const extra: "\n\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime" =
      "\n\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime";
    const source: string = text + extra;
    await editor.fill(source);
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(
          ".joint-type-standard-headeredrectangle text:first-of-type",
        ),
      ].some(
        (element: Element) =>
          element.textContent === "ModificationRecord",
      ),
    );
    assert.equal(await editor.locator(".dsl-error").count(), 0);
    const classBox: import("playwright").Locator = page
      .locator(".joint-type-standard-headeredrectangle")
      .filter({ hasText: "isPartial" });
    assert.ok(((await classBox.textContent()) ?? "").includes("modifications"));
    await editor.fill(source.replace("isPartial : bool", "isComplete : bool"));
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(".joint-type-standard-headeredrectangle"),
      ].some((item: Element) =>
        (item.textContent ?? "").includes("isComplete : bool"),
      ),
    );
    await editor.fill(source);
    await editor.fill(source.replace("\n\nClass\n", "\n\nClass1\n"));
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(".joint-type-standard-rectangle text"),
      ].some((item: Element) => item.textContent === "Class"),
    );
    assert.ok(
      (
        await page
          .locator(".joint-type-standard-headeredrectangle")
          .allTextContents()
      ).some((item: string) => item.includes("Class1")),
    );
    await editor.fill(source);
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".joint-type-standard-rectangle").length ===
        0,
    );
    await editor.fill(source.replace("\n\nClass\n", "\n\nClassDiagram\n"));
    const conflict: import("playwright").Locator = editor
      .locator(".dsl-error")
      .filter({ hasText: "ClassDiagram" });
    await conflict.first().waitFor();
    assert.match(
      (await conflict.first().getAttribute("title")) ?? "",
      /Duplicate class name/,
    );
    await conflict.first().hover();
    await page
      .locator(".dsl-diagnostic-tooltip")
      .filter({ hasText: "Duplicate class name: ClassDiagram." })
      .waitFor();
    await editor.fill(source.replace("\n\nClass\n", "\nClass\n"));
    const separator: import("playwright").Locator = editor
      .locator(".dsl-error")
      .filter({ hasText: "Class" });
    await separator.first().waitFor();
    assert.match(
      (await separator.first().getAttribute("title")) ?? "",
      /blank line/,
    );
  });
}
