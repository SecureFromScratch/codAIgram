import type { Locator } from "playwright";
import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { logAndThrow } from "../../logging.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title:
    "highlights class, methods, parameter types, and ownership while editing",
  prompt: {
    availability: "available",
    old: "Define a DSL and syntax highlighting for class declarations, methods, parameters, types, and OWNS declarations.",
  
    history: [
      { when: "2026/11/15 09:35", text: "define a dsl for the textual representation of the class diagrams.\nadd syntax highlighting for class name line (bold+italic+underline), method name + params in ts syntax highlighting, OWNS in italic+underline with arg name and type in ts syntax highlighting style" },
      { when: "2026/11/15 09:35", text: "changes OWNS highlighting - black color, bold, no underline or italics.\nadd italics to argument types" },
      { when: "2026/11/15 09:35", text: "in dsl syntax highlighting - let's swap the italics to be on arg names instead of arg types." },
    ],
  },
};
export function registerDslTokensCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const editor: Locator = page.getByRole("textbox", { name: "Diagram text", });
    await page.evaluate(() => {
      const app: { selectClass: (name: string) => void } | undefined =
        (window as Window & { __app?: { selectClass: (name: string) => void } }).__app;
      if (!app) logAndThrow(new Error("Application command hook is unavailable."));
      app.selectClass("ClassDiagram");
    });
    await page.waitForFunction(
      () => document.querySelector(".cm-content .cm-line")?.textContent === "ClassDiagram",
    );
    const heading: Locator = editor
      .locator(".cm-line")
      .first()
      .locator(".dsl-class-name");
    assert.equal(await heading.innerText(), "ClassDiagram");
    const headingStyle: {
      readonly weight: string;
      readonly style: string;
      readonly decoration: string;
    } = await heading.evaluate(
      (
        element: HTMLElement,
      ) => ({
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
    const owns: Locator = editor.locator(".dsl-ownership");
    assert.equal(await owns.innerText(), "OWNS");
    const ownsStyle: {
      readonly style: string;
      readonly weight: string;
      readonly decoration: string;
      readonly color: string;
    } = await owns.evaluate(
      (
        element: HTMLElement,
      ) => ({
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
          (element: HTMLElement) => getComputedStyle(element).fontStyle,
        ),
      "italic",
    );
    assert.equal(
      await editor
        .locator(".dsl-type-keyword")
        .first()
        .evaluate(
          (element: HTMLElement) => getComputedStyle(element).fontStyle,
        ),
      "normal",
    );
    assert.equal(
      await editor
        .locator(".dsl-type")
        .last()
        .evaluate(
          (element: HTMLElement) => getComputedStyle(element).fontStyle,
        ),
      "normal",
    );
    assert.equal(await editor.locator(".dsl-type").last().innerText(), "Class");
    const updated: string =
      "Diagram\n  add(\n    value: Map<string, number>\n    )\nOWNS things: Thing[]";
    await editor.fill(updated);
    assert.equal(
      await editor.locator(".cm-line").first().locator(".dsl-class-name").innerText(),
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
