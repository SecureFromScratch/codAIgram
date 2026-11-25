import type { Locator } from "playwright";
import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title:
    "reports a hidden existing class conflict until @ restores its saved definition",
  prompt: {
    availability: "available",
    old: "Starting a class using an existing name is a conflict; adding @ removes it and restores the existing class definition for editing.",
  
    history: [
      { when: "2026/11/15 09:35", text: "final test: starting a class in the text editor with the name of an existing class is a conflict error (wavy-red-underline), but if that class name is then followed by a @ then the @ is removed and the contents of the appropriate existing class is copied into the editor (the @ signifies we want to edit an existing class)." },
    ],
  },
};
export function registerRestoreExistingClassCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const existing: string =
      "ExistingClass\n  field: string\n  run(value: number)";
    await editor.fill(`${text}\n\n${existing}`);
    await page.locator('[data-class-name="ClassDiagram"]').dblclick();
    await page.waitForFunction(
      (expected: string) =>
        [...document.querySelectorAll(".cm-content .cm-line")]
          .map((line: Element) => line.textContent)
          .join("\n") === expected,
      text,
    );
    await editor.fill(`${text}\n\nExistingClass`);
    const conflict: Locator = editor
      .locator(".dsl-error")
      .filter({ hasText: "ExistingClass" });
    await conflict.first().waitFor();
    const style: { readonly style: string; readonly color: string; } = await conflict.first().evaluate(
      (
        element: HTMLElement,
      ) => ({
        style: getComputedStyle(element).textDecorationStyle,
        color: getComputedStyle(element).textDecorationColor,
      }),
    );
    assert.equal(style.style, "wavy");
    assert.equal(style.color, "rgb(220, 38, 38)");
    await editor.press("End");
    await page.keyboard.type("@");
    await page.waitForFunction(
      (expected: string) =>
        [...document.querySelectorAll(".cm-content .cm-line")]
          .map((line: Element) => line.textContent)
          .join("\n") === expected,
      `${text}\n\n${existing}`,
    );
    assert.equal(await editor.locator(".dsl-error").count(), 0);
    assert.equal(
      await page.locator('[data-class-name="ExistingClass"]').count(),
      1,
    );
    await editor.fill(
      `${text}\n\n${existing.replace("run(value: number)", "execute(value: number)")}`,
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-class-name="ExistingClass"]')
          ?.textContent?.includes("execute") === true,
    );
  });
}
