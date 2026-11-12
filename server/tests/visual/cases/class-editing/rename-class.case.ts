import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "updates the class box when its title changes",
  prompt: {
    availability: "available",
    text: "Changing a class title reflects in its class box.",
  },
};
export function registerRenameClassCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace(/^ClassDiagram/, "NewDiagram"));
    await page.waitForFunction(
      () =>
        document.querySelector(".joint-type-standard-headeredrectangle text")
          ?.textContent === "NewDiagram",
    );
  });
}
