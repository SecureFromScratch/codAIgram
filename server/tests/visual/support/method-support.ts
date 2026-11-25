import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { page } from "../test-support.js";
export async function waitForMethodNames(
  className: string,
  names: readonly string[],
): Promise<void> {
  await page.waitForFunction(
    (input: { 
      readonly className: string; 
      readonly expected: readonly string[] 
    }) =>
      JSON.stringify(
        [
          ...document.querySelectorAll(
            `[data-class-name="${input.className}"] [data-method-index]`,
          ),
        ].map((item: Element) => item.textContent),
      ) === JSON.stringify(input.expected),
    { className, expected: names },
  );
}
export async function assertRedWavyError(
  editor: Locator,
  expected: string,
): Promise<void> {
  const errors: Locator = editor.locator(".dsl-error");
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
