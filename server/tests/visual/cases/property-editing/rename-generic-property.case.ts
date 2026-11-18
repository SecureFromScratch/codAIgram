import assert from "node:assert/strict";
import { test } from "node:test";
import { page, setVisualClasses } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: {
      when: string;
      text: string;
    }[];
  };
} = {
  title: "renames a generic property and updates its class box without a DSL error",
  prompt: {
    availability: "available",
    history: [
      {
        when: "2026/11/17 09:35",
        text: "I changed the name of the property from description to desc1 and received a DSL message even though the property was valid; the editor showed no red wavy underline.",
      },
    ],
  },
};

export function registerRenameGenericPropertyCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([
      {
        name: "Archetype",
        methods: [
          { name: "kind", overloads: [[{ arg: "+RO", t: "string" }]] },
          {
            name: "description",
            overloads: [[{ arg: "+RO", t: "Readonly<ValueDescription>" }]],
          },
          {
            name: "validate",
            overloads: [[
              { arg: "input", t: "unknown" },
              { arg: "context", t: "ArchetypeContext" },
            ]],
          },
        ],
        relations: [
          {
            kind: "UNK",
            name: "description",
            target: "ValueDescription",
            many: true,
          },
        ],
      },
      {
        name: "ArchetypeContext",
        methods: [
          { name: "typeName", overloads: [[{ arg: "+RO", t: "string" }]] },
        ],
        relations: [],
      },
      { name: "ValueDescription", methods: [], relations: [], state: "partial" },
    ]);

    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor("Archetype");
    const editedText: string = text.replace(
      "description: Readonly<ValueDescription>",
      "desc1: Readonly<ValueDescription>",
    );
    assert.notEqual(editedText, text);

    await editor.fill(editedText);
    await page.getByText("Diagram is up to date", { exact: true }).waitFor();
    const classBox: import("playwright").Locator = page.locator(
      '[data-class-name="Archetype"]',
    );
    await page.waitForFunction(() =>
      document
        .querySelector('[data-class-name="Archetype"]')
        ?.textContent?.includes("desc1: ValueDescription") === true,
    );
    assert.ok((await classBox.textContent())?.includes("desc1: ValueDescription"));
    assert.equal(await editor.locator(".dsl-error").count(), 0);
  });
}
