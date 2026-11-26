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
  title: "updates method tooltip argument names, types, and count",
  prompt: {
    availability: "available",
    old: "Changing method argument names, types, and amount reflects in the tooltip.",
  
    history: [
      { when: "2026/11/15 09:35", text: "more tests:\n\n- removing a method line removes it from the method area in the classbox.\n- adding a method adds it to the method area.\n- syntax error wavy-red-underline appears for invalid method syntax\n- changing name of method reflects in classbox\n- changing method args - name, type, amount - reflects in tooltip" },
    ],
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
    const method: Locator = page.locator(
      '[data-class-name="ClassDiagram"] [data-method-tooltip^="addClass("]',
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-class-name="ClassDiagram"] [data-method-tooltip^="addClass("]')
          ?.getAttribute("data-method-tooltip") ===
        "addClass(label, option, items)\n-label: number\n-option: boolean\n-items: ✏️Item[]",
    );
    await method.hover();
    const tooltip: Locator = page.getByRole("tooltip");
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
        "-items: ✏️Item[]",
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
