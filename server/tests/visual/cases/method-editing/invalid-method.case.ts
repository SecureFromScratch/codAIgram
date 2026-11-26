import assert from "node:assert/strict";
import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import {
  assertRedWavyError,
  waitForMethodNames,
} from "../../support/method-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title: "marks invalid method syntax and retains the last valid graph",
  prompt: {
    availability: "available",
    old: "A syntax error wavy-red-underlines invalid method syntax while preserving the prior valid class-box methods.",
  
    history: [
      { when: "2026/11/15 09:35", text: "more tests:\n\n- removing a method line removes it from the method area in the classbox.\n- adding a method adds it to the method area.\n- syntax error wavy-red-underline appears for invalid method syntax" },
    ],
  },
};
export function registerInvalidMethodCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(
      text.replace(
        "addClass(name: string, publicMethods: string[])",
        "addClass(name string)",
      ),
    );
    await assertRedWavyError(editor, "addClass(name string)");
    await waitForMethodNames("ClassDiagram", [
      "addClass()",
      "addPartialClass()",
      "connectClasses()",
      "recalcLayout()",
    ]);
    await editor.fill(text);
    assert.equal(await editor.locator(".dsl-error").count(), 0);
  });
}
