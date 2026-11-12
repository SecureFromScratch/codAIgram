import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import { waitForMethodNames } from "../../support/method-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "restores a selected and deleted method with undo in its original graph position",
  prompt: {
    availability: "available",
    text: "Delete the first method using selection and Backspace, then Ctrl+Z; verify editor text, method order, and its full tooltip signature are restored.",
  },
};
export function registerUndoDeleteMethodCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const methodLine: import("playwright").Locator = editor
      .locator(".cm-line")
      .filter({
        hasText: "addClass(name: string, publicMethods: string[])",
      });
    await methodLine.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    assert.equal(
      await page.evaluate(
        () => window.getSelection()?.toString() ?? "",
      ),
      "  addClass(name: string, publicMethods: string[])",
    );
    await page.keyboard.press("Backspace");
    await waitForMethodNames([
      "addPartialClass",
      "connectClasses",
      "recalcLayout",
    ]);
    await page.keyboard.press("Control+z");
    await page.waitForFunction(
      (expected: string) =>
        [...document.querySelectorAll(".cm-content .cm-line")]
          .map((line: Element) => line.textContent)
          .join("\n") === expected,
      text,
    );
    await waitForMethodNames([
      "addClass",
      "addPartialClass",
      "connectClasses",
      "recalcLayout",
    ]);
    const restored: import("playwright").Locator = page.locator(
      '.joint-type-standard-headeredrectangle [data-method-index="0"]',
    );
    assert.equal(
      await restored.getAttribute("data-method-tooltip"),
      "addClass(name, publicMethods)\n-name: string\n-publicMethods: string[]",
    );
    await restored.hover();
    const tooltip: import("playwright").Locator = page.getByRole("tooltip");
    await tooltip.waitFor();
    const content: string = ((await tooltip.textContent()) ?? "").replace(
      /\s+/g,
      " ",
    );
    {
      const __partValues: readonly string[] = [
        "addClass(name, publicMethods)",
        "name: string",
        "publicMethods: string[]",
      ];
      for (
        let __partIndex: number = 0;
        __partIndex < __partValues.length;
        __partIndex += 1
      ) {
        const part: string = __partValues[__partIndex]!;
        assert.ok(content.includes(part), part);
      }
    }
  });
}
