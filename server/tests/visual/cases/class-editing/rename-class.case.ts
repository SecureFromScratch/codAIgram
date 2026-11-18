import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
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
  title: "updates the class box when its title changes",
  prompt: {
    availability: "available",
    old: "Changing a class title reflects in its class box.",
  
    history: [
      { when: "2026/11/15 09:35", text: "more tests:\n\n- removing a method line removes it from the method area in the classbox.\n- adding a method adds it to the method area.\n- syntax error wavy-red-underline appears for invalid method syntax\n- changing name of method reflects in classbox\n- changing method args - name, type, amount - reflects in tooltip\n- changing class title reflects in classbox" },
    ],
  },
};
export function registerRenameClassCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace(/^ClassDiagram/, "NewDiagram"));
    await page.waitForFunction(
      () =>
        document.querySelector('[data-class-name="NewDiagram"]') !== null,
    );
  });
}
