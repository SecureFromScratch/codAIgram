import type { Locator } from "playwright";
import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import {
  resetOwnershipEditor,
  waitForLinkLabels,
} from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title:
    "removes an invalid ownership link, marks its declaration, and recovers when retyped",
  prompt: {
    availability: "available",
    old: "If OWNS is removed or mangled, remove the connector and mark the declaration with a red wavy syntax error; restore it when OWNS is retyped correctly.",
  
    history: [
      { when: "2026/11/15 09:35", text: "let's start updating dynamically from text to graph.\nadd a test - if OWNS keyword is removed/mangled - the line connecting to Class classbox is removed, classes:Class[] should be wavy-red-underlines to show syntax error." },
      { when: "2026/11/15 09:35", text: "let's start updating dynamically from text to graph.\nadd a test - if OWNS keyword is removed/mangled - the line connecting to Class classbox is removed, classes:Class[] should be wavy-red-underlines to show syntax error.\nIf the OWNS keyword is retyped correctly - the line returns." },
    ],
  },
};
export function registerInvalidOwnershipCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
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
          () => document.querySelectorAll(".joint-link").length === 0,
        );
        const error: Locator =
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
          ) => ({
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
