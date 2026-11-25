import assert from "node:assert/strict";
import { test } from "node:test";
import { page, setVisualClasses } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: { when: string; text: string; }[];
  };
} = {
  title: "adds an editor property to the matching class box",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/17 09:35", text: "add a visual test - adding a property in the text editor (to a class) is updated in the class box", },
    ],
  },
};

export function registerAddPropertyCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([
      {
        name: "ClassDiagram",
        methods: [
          {
            name: "description",
            overloads: [[{ arg: "+RO", t: "string" }]],
          },
        ],
        relations: [
          {
            kind: "OWNS",
            name: "classes",
            target: "Class",
            many: true,
          },
        ],
      },
      {
        name: "Class",
        methods: [],
        relations: [],
        state: "partial",
      },
    ]);
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const addedProperty: string = "  createdAt: datetime";
    const editedText: string = text.replace(
      "OWNS classes: Class[]",
      `${addedProperty}\nOWNS classes: Class[]`,
    );
    assert.notEqual(editedText, text);

    await editor.fill(editedText);
    await page.waitForFunction(() =>
      document
        .querySelector('[data-class-name="ClassDiagram"]')
        ?.textContent?.includes("createdAt: datetime") === true,
    );

    const classText: string = await page
      .locator('[data-class-name="ClassDiagram"]')
      .textContent() ?? "";
    assert.ok(classText.includes("description: string"));
    assert.ok(classText.includes("createdAt: datetime"));
  });
}
