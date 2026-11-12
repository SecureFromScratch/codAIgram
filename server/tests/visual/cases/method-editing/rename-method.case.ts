import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import { waitForMethodNames } from "../../support/method-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "updates the class box when a method is renamed",
  prompt: {
    availability: "available",
    text: "Changing a method name reflects in the class box.",
  },
};
export function registerRenameMethodCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace("addPartialClass", "createPartialClass"));
    await waitForMethodNames([
      "addClass",
      "createPartialClass",
      "connectClasses",
      "recalcLayout",
    ]);
  });
}
