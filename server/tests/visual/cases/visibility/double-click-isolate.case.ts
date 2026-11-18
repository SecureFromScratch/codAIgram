import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: {
      when: string;
      text: string;
    }[];
  };
} = {
  title: "displays only the double-clicked class text and its eye badge",
  prompt: {
    availability: "available",
    old: "Double-clicking a class removes all other markup from the editor and leaves only the double-clicked class with its open-eye badge.",
  
    history: [
      { when: "2026/11/15 09:35", text: "test: double clicking a class in the visual removes all class texts from the text editor and puts only the double clicked class's text in the text editor + the class gets an eyes-open badge." },
    ],
  },
};
export function registerDoubleClickIsolateCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(`${text}\n\nClass\n  isPartial: bool`);
    const target: import("playwright").Locator = page.locator(
      '[data-class-name="Class"]',
    );
    await target.dblclick();
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".cm-content .cm-line")]
          .map((line: Element) => line.textContent)
          .join("\n") === "Class\n  isPartial: bool",
    );
    assert.equal(await page.locator("[data-eye-badge]").count(), 1);
    assert.equal(await target.locator("[data-eye-badge]").count(), 1);
    assert.equal(
      await page.locator(".joint-type-standard-headeredrectangle").count(),
      2,
      "hidden source classes remain on the graph",
    );
  });
}
