import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
import { waitForMethodNames } from "../../support/method-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title: "updates the class box when a method is renamed",
  prompt: {
    availability: "available",
    old: "Changing a method name reflects in the class box.",
  
    history: [
      { when: "2026/11/15 09:35", text: "more tests:\n\n- removing a method line removes it from the method area in the classbox.\n- adding a method adds it to the method area.\n- syntax error wavy-red-underline appears for invalid method syntax\n- changing name of method reflects in classbox" },
    ],
  },
};
export function registerRenameMethodCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace("addPartialClass", "createPartialClass"));
    await waitForMethodNames("ClassDiagram", [
      "addClass",
      "createPartialClass",
      "connectClasses",
      "recalcLayout",
    ]);
  });
}
