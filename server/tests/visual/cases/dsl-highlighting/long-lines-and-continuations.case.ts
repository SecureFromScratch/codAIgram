import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "keeps long editor lines unwrapped and accepts indented multiline methods",
  prompt: {
    availability: "available",
    text: "Newlines do not change the DSL meaning; method continuation lines need at least four spaces and source lines never wrap.",
  },
};
export function registerLongLinesAndContinuationsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const editor: import("playwright").Locator = page.getByRole("textbox", { name: "Diagram text", });
    const longName: string = "a".repeat(180);
    await editor.fill(
      `Diagram\n  f(\n    name: string,\n\n      count: integer\n    )\n  ${longName}()\nOWNS classes: Class[]`,
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector(".status")
          ?.textContent?.includes("up to date") === true,
    );
    const method: import("playwright").Locator = page
      .locator(".joint-type-standard-headeredrectangle [data-method-tooltip]")
      .first();
    await method.waitFor();
    assert.equal(
      await method.getAttribute("data-method-tooltip"),
      "f(name, count)\n-name: string\n-count: integer",
    );
    const dimensions: {
      readonly width: number;
      readonly height: number;
      readonly whiteSpace: string;
      readonly viewport: number;
    } = await page
      .locator(".cm-line")
      .filter({ hasText: longName })
      .evaluate(
        (
          line: HTMLElement,
        ) => {
          const scroller: ReturnType<HTMLElement["closest"]> =
            line.closest<HTMLElement>(".cm-scroller");
          if (!scroller) window.logAndThrow(new Error("Expected editor scroller."));
          return {
            width: line.getBoundingClientRect().width,
            height: line.getBoundingClientRect().height,
            whiteSpace: getComputedStyle(line).whiteSpace,
            viewport: scroller.clientWidth,
          };
        },
      );
    assert.ok(
      dimensions.width > dimensions.viewport,
      "long source line overflows horizontally",
    );
    assert.ok(
      ["pre", "nowrap"].includes(dimensions.whiteSpace),
      `source line does not wrap: ${dimensions.whiteSpace}`,
    );
    await editor.fill("Diagram\n  f(\n  name: string)");
    await page.waitForFunction(
      () =>
        document
          .querySelector(".status")
          ?.textContent?.includes("continuation") === true,
    );
    assert.equal(
      await method.getAttribute("data-method-tooltip"),
      "f(name, count)\n-name: string\n-count: integer",
      "invalid edit retains the previous valid diagram",
    );
  });
}
