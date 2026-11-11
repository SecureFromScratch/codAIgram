import assert from "node:assert/strict";
import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import { assertRedWavyError } from "../../support/method-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "marks incorrect method indentation with a red wavy underline",
  prompt: {
    availability: "available",
    text: "Wrong method indentation produces a red-wavy underline.",
  },
};
export function registerInvalidIndentationCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace("  addPartialClass", " addPartialClass"));
    await assertRedWavyError(editor, "addPartialClass(name: string)");
    await editor.fill(text);
    assert.equal(await editor.locator(".dsl-error").count(), 0);
  });
}
