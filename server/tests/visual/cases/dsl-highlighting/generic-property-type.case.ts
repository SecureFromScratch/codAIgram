import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: { when: string; text: string }[];
  };
} = {
  title: "marks incomplete generic property types as DSL syntax errors",
  prompt: {
    availability: "available",
    history: [
      {
        when: "2026/11/18 09:35",
        text: "add test: changing a field like description: Readonly<ValueDescription> to description: <ValueDescription> is a syntax error (cannot have angular brackets without preceding identifer). Another test: partial angular brackets (<Something or Something>) is a syntax error",
      },
    ],
  },
};

export function registerGenericPropertyTypeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const validSource: string = `${text}\n\nGenericHolder\n  description: Readonly<ValueDescription>`;
    const invalidPropertyTypes: readonly string[] = [
      "<ValueDescription>",
      "<Something",
      "Something>",
    ];

    for (const invalidType of invalidPropertyTypes) {
      const invalidSource: string = validSource.replace(
        "Readonly<ValueDescription>",
        invalidType,
      );
      await editor.fill(invalidSource);

      const invalidField: string = `description: ${invalidType}`;
      const diagnostic: import("playwright").Locator = editor
        .locator(".dsl-error")
        .filter({ hasText: invalidField });
      await diagnostic.waitFor();
      const decoration: {
        readonly line: string;
        readonly style: string;
        readonly color: string;
      } = await diagnostic.evaluate((element: HTMLElement) => ({
        line: getComputedStyle(element).textDecorationLine,
        style: getComputedStyle(element).textDecorationStyle,
        color: getComputedStyle(element).textDecorationColor,
      }));
      assert.ok(decoration.line.includes("underline"));
      assert.equal(decoration.style, "wavy");
      assert.equal(decoration.color, "rgb(220, 38, 38)");
    }
  });
}
