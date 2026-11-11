import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "preserves a non-partial target alongside the question mark when its owned type is missing",
  prompt: {
    availability: "available",
    text: "When the owned type is missing, preserve an existing non-partial target and display the unresolved question mark.",
  },
};
export function registerMissingOwnedNonpartialCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    await page.route("**/api/classesDetails", async (route): Promise<void> => {
      const response: import("playwright").APIResponse = await route.fetch();
      const body: { name: string; isPartial: boolean; }[] = await response.json();
      const target:
        | { name: string; isPartial: boolean; }
        | undefined = body.find((item): boolean => item.name === "Class");
      if (target === undefined)
        throw new Error("Expected the Class details response.");
      target.isPartial = false;
      await route.fulfill({ response, json: body });
    });
    try {
      const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
        await resetOwnershipEditor();
      await editor.fill(text.replace("OWNS classes: Class[]", "OWNS classes:"));
      await page.waitForFunction((): boolean =>
        [
          ...document.querySelectorAll(".joint-type-standard-rectangle text"),
        ].some((item: Element): boolean => item.textContent === "?"),
      );
      const targets: string[] = await page
        .locator(".joint-type-standard-rectangle text")
        .allTextContents();
      assert.ok(targets.includes("Class"));
      assert.ok(targets.includes("?"));
    } finally {
      await page.unroute("**/api/classesDetails");
    }
  });
}
