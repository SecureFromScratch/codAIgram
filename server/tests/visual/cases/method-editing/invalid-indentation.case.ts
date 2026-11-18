import assert from "node:assert/strict";
import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import { assertRedWavyError } from "../../support/method-support.js";
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
  title: "marks incorrect method indentation with a red wavy underline",
  prompt: {
    availability: "available",
    old: "Wrong method indentation produces a red-wavy underline.",
  
    history: [
      { when: "2026/11/15 09:35", text: "more tests:\n\n- removing a method line removes it from the method area in the classbox.\n- adding a method adds it to the method area.\n- syntax error wavy-red-underline appears for invalid method syntax\n- changing name of method reflects in classbox\n- changing method args - name, type, amount - reflects in tooltip\n- changing class title reflects in classbox\n- wrong indentation produces red-wavy-nuderline" },
    ],
  },
};
export function registerInvalidIndentationCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace("  addPartialClass", " addPartialClass"));
    await assertRedWavyError(editor, "addPartialClass(name: string)");
    await editor.fill(text);
    assert.equal(await editor.locator(".dsl-error").count(), 0);
  });
}
