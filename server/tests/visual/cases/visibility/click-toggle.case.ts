import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "toggles a graph class markup and eye badge when clicked",
  prompt: {
    availability: "available",
    text: "Clicking a graph class adds its markup and eye badge; clicking it again removes both.",
  },
};
export function registerClickToggleCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const target: import("playwright").Locator = page
      .locator(".joint-type-standard-rectangle")
      .filter({ hasText: "Class" });
    assert.equal(await target.locator("[data-eye-badge]").count(), 0);
    await target.click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-eye-badge]").length === 2,
    );
    assert.equal(
      (await editor.locator(".cm-line").allTextContents()).join("\n"),
      `${text}\n\nClass`,
    );
    await page
      .locator(".joint-type-standard-rectangle")
      .filter({ hasText: "Class" })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-eye-badge]").length === 1,
    );
    assert.equal(
      (await editor.locator(".cm-line").allTextContents()).join("\n"),
      text,
    );
  });
}
