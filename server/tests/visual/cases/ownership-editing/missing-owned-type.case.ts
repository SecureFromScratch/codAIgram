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
    "shows a question mark and removes a partial target when its owned type is missing",
  prompt: {
    availability: "available",
    old: "If Class[] is removed completely, replace the partial Class box with a question mark and restore it after correction.",
  
    history: [
      { when: "2026/11/15 09:35", text: "let's start updating dynamically from text to graph.\nadd a test - if OWNS keyword is removed/mangled - the line connecting to Class classbox is removed, classes:Class[] should be wavy-red-underlines to show syntax error.\nIf the OWNS keyword is retyped correctly - the line returns.\nAnother test: the Class[] type for classes is modified to Class (singular) - the arity of the line (*) is removed. also test for the other direction - singular to any-arity.\nIf the \"Class[]\" is removed completely - the Class classbox is replaced with a question mark, if Class is a partial class (otherwise it persists)." },
    ],
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
