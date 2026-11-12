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
    "shows a question mark and removes a partial target when its owned type is missing",
  prompt: {
    availability: "available",
    text: "If Class[] is removed completely, replace the partial Class box with a question mark and restore it after correction.",
  },
};
export function registerMissingOwnedTypeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace("OWNS classes: Class[]", "OWNS classes:"));
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(".joint-type-standard-rectangle text"),
      ].some((item: Element) => item.textContent === "?"),
    );
    const targets: string[] = await page
      .locator(".joint-type-standard-rectangle text")
      .allTextContents();
    assert.ok(!targets.includes("Class"));
    assert.ok(targets.includes("?"));
    await editor.fill(text);
    await waitForLinkLabels(["classes", "*"]);
  });
}
