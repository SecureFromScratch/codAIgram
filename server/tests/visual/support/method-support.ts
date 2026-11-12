import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { page } from "../test-support.js";
export async function waitForMethodNames(
  names: readonly string[],
): Promise<void> {
  await page.waitForFunction(
    (expected: readonly string[]) =>
      JSON.stringify(
        [
          ...document.querySelectorAll(
            ".joint-type-standard-headeredrectangle [data-method-index]",
          ),
        ].map((item: Element) => item.textContent),
      ) === JSON.stringify(expected),
    names,
  );
}
export async function assertRedWavyError(
  editor: import("playwright").Locator,
  expected: string,
): Promise<void> {
  const errors: import("playwright").Locator = editor.locator(".dsl-error");
  await errors.first().waitFor();
  assert.ok((await errors.allTextContents()).join("").includes(expected));
  const style: {
    readonly line: string;
    readonly style: string;
    readonly color: string;
  } = await errors.first().evaluate(
    (
      element: HTMLElement,
    ) => ({
      line: getComputedStyle(element).textDecorationLine,
      style: getComputedStyle(element).textDecorationStyle,
      color: getComputedStyle(element).textDecorationColor,
    }),
  );
  assert.ok(style.line.includes("underline"));
  assert.equal(style.style, "wavy");
  assert.equal(style.color, "rgb(220, 38, 38)");
}
