import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
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
  title: "marks a property after a relationship as a DSL syntax error",
  prompt: {
    availability: "available",
    history: [
      {
        when: "2026/11/17 00:00",
        text: "add a test: text editor shows a dsl syntax error if a property is after the relationships (within the same class == before the separaiting empty line)",
      },
    ],
  },
};

export function registerPropertyAfterRelationshipCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const invalidProperty: string = "misplaced: string";
    const source: string = text.replace(
      "OWNS classes: Class[]",
      `OWNS classes: Class[]\n  ${invalidProperty}`,
    );

    await editor.fill(source);

    const diagnostic: import("playwright").Locator = editor
      .locator(".dsl-error")
      .filter({ hasText: invalidProperty });
    await diagnostic.waitFor();
    const style: {
      readonly line: string;
      readonly style: string;
      readonly color: string;
    } = await diagnostic.evaluate((element: HTMLElement) => ({
      line: getComputedStyle(element).textDecorationLine,
      style: getComputedStyle(element).textDecorationStyle,
      color: getComputedStyle(element).textDecorationColor,
    }));
    assert.ok(style.line.includes("underline"));
    assert.equal(style.style, "wavy");
    assert.equal(style.color, "rgb(220, 38, 38)");
    assert.equal(
      await diagnostic.getAttribute("title"),
      "Properties and methods must precede relationships.",
    );
    const relationshipPosition: number = source.indexOf("OWNS classes: Class[]");
    const propertyPosition: number = source.indexOf(invalidProperty);
    assert.ok(relationshipPosition >= 0 && propertyPosition > relationshipPosition);
    assert.ok(!source.slice(relationshipPosition, propertyPosition).includes("\n\n"));
  });
}
