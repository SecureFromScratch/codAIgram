import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import { waitForMethodNames } from "../../support/method-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "removes a deleted method from the class box",
  prompt: {
    availability: "available",
    text: "Removing a method line removes it from the method area in the class box.",
  },
};
export function registerRemoveMethodCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace("  addPartialClass(name: string)\n", ""));
    await waitForMethodNames(["addClass", "connectClasses", "recalcLayout"]);
  });
}
