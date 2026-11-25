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
  title: "updates the class box when a property type changes in the editor",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/17 09:35", text: "add a test: changing the first property type in the first class to Something updates that class's property in the visual class box", },
    ],
  },
};

export function registerPropertyTypeChangeCase(): void {
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
    assert.match(text, /description: string/);

    await editor.fill(text.replace("description: string", "description: Something"));
    await page.waitForFunction(() =>
      document
        .querySelector('[data-class-name="ClassDiagram"]')
        ?.textContent?.includes("description: Something") === true,
    );

    const classText: string = await page
      .locator('[data-class-name="ClassDiagram"]')
      .textContent() ?? "";
    assert.ok(classText.includes("description: Something"));
    assert.ok(!classText.includes("description: string"));
  });
}
