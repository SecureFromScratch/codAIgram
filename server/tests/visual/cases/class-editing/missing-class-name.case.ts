import assert from "node:assert/strict";
import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "displays a red wavy diagnostic for a missing class name",
  prompt: {
    availability: "available",
    text: "A missing class name produces a red-wavy underline and a useful diagnostic.",
  },
};
export function registerMissingClassNameCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(text.replace(/^ClassDiagram/, ""));
    const missing: import("playwright").Locator =
      editor.locator(".dsl-missing-class");
    await missing.waitFor();
    const style: {
      readonly content: string;
      readonly line: string;
      readonly style: string;
      readonly color: string;
    } = await missing.evaluate(
      (
        element: HTMLElement,
      ): {
        readonly content: string;
        readonly line: string;
        readonly style: string;
        readonly color: string;
      } => ({
        content: getComputedStyle(element, "::before").content,
        line: getComputedStyle(element, "::before").textDecorationLine,
        style: getComputedStyle(element, "::before").textDecorationStyle,
        color: getComputedStyle(element, "::before").textDecorationColor,
      }),
    );
    assert.ok(style.content.includes("Class name required"));
    assert.ok(style.line.includes("underline"));
    assert.equal(style.style, "wavy");
    assert.equal(style.color, "rgb(220, 38, 38)");
    await editor.fill(text);
    assert.equal(await editor.locator(".dsl-missing-class").count(), 0);
  });
}
