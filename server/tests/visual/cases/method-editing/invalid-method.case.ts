import assert from "node:assert/strict";
import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import {
  assertRedWavyError,
  waitForMethodNames,
} from "../../support/method-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "marks invalid method syntax and retains the last valid graph",
  prompt: {
    availability: "available",
    text: "A syntax error wavy-red-underlines invalid method syntax while preserving the prior valid class-box methods.",
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
    await waitForMethodNames([
      "addClass",
      "addPartialClass",
      "connectClasses",
      "recalcLayout",
    ]);
    await editor.fill(text);
    assert.equal(await editor.locator(".dsl-error").count(), 0);
  });
}
