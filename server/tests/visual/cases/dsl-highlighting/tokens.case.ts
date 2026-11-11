import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "highlights class, methods, parameter types, and ownership while editing",
  prompt: {
    availability: "available",
    text: "Define a DSL and syntax highlighting for class declarations, methods, parameters, types, and OWNS declarations.",
  },
};
export function registerDslTokensCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const editor: import("playwright").Locator = page.getByRole("textbox", { name: "Diagram text", });
    const heading: import("playwright").Locator =
      editor.locator(".dsl-class-name");
    assert.equal(await heading.innerText(), "ClassDiagram");
    const headingStyle: {
      readonly weight: string;
      readonly style: string;
      readonly decoration: string;
    } = await heading.evaluate(
      (
        element: HTMLElement,
      ): {
        readonly weight: string;
        readonly style: string;
        readonly decoration: string;
      } => ({
        weight: getComputedStyle(element).fontWeight,
        style: getComputedStyle(element).fontStyle,
        decoration: getComputedStyle(element).textDecorationLine,
      }),
    );
    assert.ok(Number(headingStyle.weight) >= 700);
    assert.equal(headingStyle.style, "italic");
    assert.ok(headingStyle.decoration.includes("underline"));
    assert.equal(
      await editor.locator(".dsl-method-name").first().innerText(),
      "addClass",
    );
    assert.equal(
      await editor.locator(".dsl-parameter").first().innerText(),
      "name",
    );
    assert.equal(
      await editor.locator(".dsl-type-keyword").first().innerText(),
      "string",
    );
    const owns: import("playwright").Locator = editor.locator(".dsl-ownership");
    assert.equal(await owns.innerText(), "OWNS");
    const ownsStyle: {
      readonly style: string;
      readonly weight: string;
      readonly decoration: string;
      readonly color: string;
    } = await owns.evaluate(
      (
        element: HTMLElement,
      ): {
        readonly style: string;
        readonly weight: string;
        readonly decoration: string;
        readonly color: string;
      } => ({
        style: getComputedStyle(element).fontStyle,
        weight: getComputedStyle(element).fontWeight,
        decoration: getComputedStyle(element).textDecorationLine,
        color: getComputedStyle(element).color,
      }),
    );
    assert.equal(ownsStyle.style, "normal");
    assert.ok(Number(ownsStyle.weight) >= 700);
    assert.equal(ownsStyle.decoration, "none");
    assert.equal(ownsStyle.color, "rgb(0, 0, 0)");
    assert.equal(
      await editor
        .locator(".dsl-parameter")
        .first()
        .evaluate(
          (element: HTMLElement): string => getComputedStyle(element).fontStyle,
        ),
      "italic",
    );
    assert.equal(
      await editor
        .locator(".dsl-type-keyword")
        .first()
        .evaluate(
          (element: HTMLElement): string => getComputedStyle(element).fontStyle,
        ),
      "normal",
    );
    assert.equal(
      await editor
        .locator(".dsl-type")
        .last()
        .evaluate(
          (element: HTMLElement): string => getComputedStyle(element).fontStyle,
        ),
      "normal",
    );
    assert.equal(await editor.locator(".dsl-type").last().innerText(), "Class");
    const updated: "Diagram\n  add(\n    value: Map<string, number>\n    )\nOWNS things: Thing[]" =
      "Diagram\n  add(\n    value: Map<string, number>\n    )\nOWNS things: Thing[]";
    await editor.fill(updated);
    assert.equal(
      await editor.locator(".dsl-class-name").innerText(),
      "Diagram",
    );
    assert.equal(await editor.locator(".dsl-method-name").innerText(), "add");
    assert.equal(
      await editor.locator(".dsl-parameter").first().innerText(),
      "value",
    );
    assert.equal(await editor.locator(".dsl-type").first().innerText(), "Map");
    assert.equal(await editor.locator(".dsl-type").last().innerText(), "Thing");
    await page.reload();
    await page.locator(".joint-type-standard-headeredrectangle").waitFor();
  });
}
