import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import {
  resetOwnershipEditor,
  waitForLinkLabels,
} from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "removes an invalid ownership link, marks its declaration, and recovers when retyped",
  prompt: {
    availability: "available",
    text: "If OWNS is removed or mangled, remove the connector and mark the declaration with a red wavy syntax error; restore it when OWNS is retyped correctly.",
  },
};
export function registerInvalidOwnershipCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    {
      const __invalidValues: readonly string[] = [
        "classes: Class[]",
        "OWX classes: Class[]",
      ];
      for (
        let __invalidIndex: number = 0;
        __invalidIndex < __invalidValues.length;
        __invalidIndex += 1
      ) {
        const invalid: string = __invalidValues[__invalidIndex]!;
        await editor.fill(text.replace("OWNS classes: Class[]", invalid));
        await page.waitForFunction(
          (): boolean => document.querySelectorAll(".joint-link").length === 0,
        );
        const error: import("playwright").Locator =
          editor.locator(".dsl-error");
        await error.first().waitFor();
        assert.ok(
          (await error.allTextContents()).join("").includes("classes: Class[]"),
        );
        const style: {
          readonly line: string;
          readonly style: string;
          readonly color: string;
        } = await error.first().evaluate(
          (
            element: HTMLElement,
          ): {
            readonly line: string;
            readonly style: string;
            readonly color: string;
          } => ({
            line: getComputedStyle(element).textDecorationLine,
            style: getComputedStyle(element).textDecorationStyle,
            color: getComputedStyle(element).textDecorationColor,
          }),
        );
        assert.ok(style.line.includes("underline"));
        assert.equal(style.style, "wavy");
        assert.equal(style.color, "rgb(220, 38, 38)");
        await editor.fill(text);
        await waitForLinkLabels(["classes", "*"]);
        assert.equal(await editor.locator(".dsl-error").count(), 0);
      }
    }
  });
}
