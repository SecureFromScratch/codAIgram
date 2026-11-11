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
    "toggles the many marker when an owned type changes between singular and array",
  prompt: {
    availability: "available",
    text: "Changing Class[] to Class removes the relationship arity star, and changing it back restores the star.",
  },
};
export function registerOwnershipMultiplicityCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(
      text.replace("OWNS classes: Class[]", "OWNS classes: Class"),
    );
    await waitForLinkLabels(["classes"]);
    assert.equal(
      await page.locator(".joint-type-standard-rectangle text").textContent(),
      "Class",
    );
    await editor.fill(text);
    await waitForLinkLabels(["classes", "*"]);
  });
}
