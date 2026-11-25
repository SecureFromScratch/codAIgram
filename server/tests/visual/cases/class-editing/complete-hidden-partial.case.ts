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
  title: "completes a hidden partial class referenced by another visible class",
  prompt: {
    availability: "available",
    old: "A hidden partial class referenced by another class can be displayed and completed without a conflict.",
  
    history: [
      { when: "2026/11/15 09:35", text: "test: in the editor - if the name of a new class is written - it is ok (no error). if the name of a partial class mentioned by another class in the editor (either as a property type, method arg or references, such as OWNS) - it is ok, and changing it (i.e. by adding methods) changes that class." },
    ],
  },
};
export function registerCompleteHiddenPartialCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await page.locator('[data-class-name="Class"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-eye-badge]").length === 2,
    );
    await page.locator('[data-class-name="Class"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll("[data-eye-badge]").length === 1,
    );
    await editor.fill(`${text}\n\nClass`);
    assert.equal(await editor.locator(".dsl-error").count(), 0);
    await editor.fill(`${text}\n\nClass\n  added()`);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-class-name="Class"]')
          ?.textContent?.includes("added") === true,
    );
    assert.equal(await editor.locator(".dsl-error").count(), 0);
  });
}
