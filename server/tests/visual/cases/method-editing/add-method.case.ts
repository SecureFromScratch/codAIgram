import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import { waitForMethodNames } from "../../support/method-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "adds a new method to the class box",
  prompt: {
    availability: "available",
    text: "Adding a method adds it to the method area in the class box.",
  },
};
export function registerAddMethodCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(
      text.replace(
        "OWNS classes: Class[]",
        "  archive(name: string)\nOWNS classes: Class[]",
      ),
    );
    await waitForMethodNames([
      "addClass",
      "addPartialClass",
      "connectClasses",
      "recalcLayout",
      "archive",
    ]);
  });
}
