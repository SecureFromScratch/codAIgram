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
    "retains the many marker without a connector member label for unnamed ownership",
  prompt: {
    availability: "available",
    old: "When OWNS has only a type, remove the connector member annotation but retain the many-arity star.",
  
    history: [
      { when: "2026/11/15 09:35", text: "let's start updating dynamically from text to graph.\nadd a test - if OWNS keyword is removed/mangled - the line connecting to Class classbox is removed, classes:Class[] should be wavy-red-underlines to show syntax error.\nIf the OWNS keyword is retyped correctly - the line returns.\nAnother test: the Class[] type for classes is modified to Class (singular) - the arity of the line (*) is removed. also test for the other direction - singular to any-arity.\nIf the \"Class[]\" is removed completely - the Class classbox is replaced with a question mark, if Class is a partial class (otherwise it persists).\nAnother test - modify the OWNS line so only the type is specified: OWNS Class[]. in this case the annotation over the line is removed." },
    ],
  },
};
export function registerUnnamedOwnershipCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace("OWNS classes: Class[]", "OWNS Class[]"));
    await waitForLinkLabels(["*"]);
    assert.equal(
      await page.locator(".joint-type-standard-rectangle text").textContent(),
      "Class",
    );
    await editor.fill(text);
    await waitForLinkLabels(["classes", "*"]);
  });
}
