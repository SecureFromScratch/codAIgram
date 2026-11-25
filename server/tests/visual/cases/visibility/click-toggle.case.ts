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
  title: "toggles a graph class markup and eye badge when clicked",
  prompt: {
    availability: "available",
    old: "Clicking a graph class adds its markup and eye badge; clicking it again removes both.",
  
    history: [
      { when: "2026/11/15 09:35", text: "add a test - clicking on a class in the graph gives it the open eye badge and shoes its markup in the text area if it is not already shown. if it is already shown it removed it from the text area AND removes the badge." },
    ],
  },
};
export function registerClickToggleCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const target: Locator = page.locator(
      '[data-class-name="Class"]',
    );
    assert.equal(await target.locator("[data-eye-badge]").count(), 0);
    await target.click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-eye-badge]").length === 2,
    );
    assert.equal(
      (await editor.locator(".cm-line").allTextContents()).join("\n"),
      `${text}\n\nClass`,
    );
    await page.locator('[data-class-name="Class"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-eye-badge]").length === 1,
    );
    assert.equal(
      (await editor.locator(".cm-line").allTextContents()).join("\n"),
      text,
    );
  });
}
