import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "updates method tooltip argument names, types, and count",
  prompt: {
    availability: "available",
    text: "Changing method argument names, types, and amount reflects in the tooltip.",
  },
};
export function registerMethodTooltipArgumentsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(
      text.replace(
        "addClass(name: string, publicMethods: string[])",
        "addClass(label: number, option: boolean, items: Item[])",
      ),
    );
    const method: import("playwright").Locator = page.locator(
      '.joint-type-standard-headeredrectangle [data-method-tooltip^="addClass("]',
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-method-tooltip^="addClass("]')
          ?.getAttribute("data-method-tooltip") ===
        "addClass(label, option, items)\n-label: number\n-option: boolean\n-items: Item[]",
    );
    await method.hover();
    const tooltip: import("playwright").Locator = page.getByRole("tooltip");
    await tooltip.waitFor();
    const content: string = ((await tooltip.textContent()) ?? "").replace(
      /\s+/g,
      " ",
    );
    {
      const __partValues: readonly string[] = [
        "addClass(label, option, items)",
        "label: number",
        "option: boolean",
        "items: Item[]",
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
