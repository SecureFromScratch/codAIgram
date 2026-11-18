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
  title: "preserves hidden class definitions while editing a displayed class",
  prompt: {
    availability: "available",
    old: "With an in-memory class model as source of truth, editing a displayed class preserves hidden class definitions.",
  
    history: [],
  },
};
export function registerPreserveHiddenDefinitionsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(`${text}\n\nClass\n  isPartial: bool`);
    await page.locator('[data-class-name="Class"]').dblclick();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".cm-content")
          ?.textContent?.includes("isPartial") === true,
    );
    await editor.fill("Class\n  isComplete: bool");
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(".joint-type-standard-headeredrectangle"),
      ].some((item: Element) =>
        (item.textContent ?? "").includes("isComplete"),
      ),
    );
    const hidden: import("playwright").Locator = page.locator(
      '[data-class-name="ClassDiagram"]',
    );
    assert.equal(await hidden.count(), 1);
    await hidden.click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".cm-content")
          ?.textContent?.includes("addPartialClass") === true,
    );
    assert.ok(
      (await editor.locator(".cm-line").allTextContents())
        .join("\n")
        .includes("isComplete: bool"),
    );
  });
}
