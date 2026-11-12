import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "leaves an empty editor and keeps the graph when the last displayed class is hidden",
  prompt: {
    availability: "available",
    text: "Hiding the final visible class leaves an empty editor while retaining the class graph.",
  },
};
export function registerHideLastClassCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await page.locator(".joint-type-standard-headeredrectangle").click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-eye-badge]").length === 0,
    );
    assert.equal(
      (await editor.locator(".cm-line").allTextContents()).join("\n"),
      "",
    );
    assert.equal(
      await page.locator(".joint-type-standard-headeredrectangle").count(),
      1,
    );
    await page.locator(".joint-type-standard-headeredrectangle").click();
    await page.waitForFunction(
      (expected: string) =>
        [...document.querySelectorAll(".cm-content .cm-line")]
          .map((line: Element) => line.textContent)
          .join("\n") === expected,
      text,
    );
  });
}
