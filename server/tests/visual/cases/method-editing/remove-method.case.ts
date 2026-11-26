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
  title: "removes a deleted method from the class box",
  prompt: {
    availability: "available",
    old: "Removing a method line removes it from the method area in the class box.",
  
    history: [
      { when: "2026/11/15 09:35", text: "more tests:\n\n- removing a method line removes it from the method area in the classbox." },
    ],
  },
};
export function registerRemoveMethodCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace("  addPartialClass(name: string)\n", ""));
    await waitForMethodNames("ClassDiagram", ["addClass()", "connectClasses()", "recalcLayout()"]);
  });
}
