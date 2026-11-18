import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: {
      when: string;
      text: string;
    }[];
  };
} = {
  title: "exposes method signatures and parameter types on hover",
  prompt: {
    availability: "available",
    old: "Class-box method lines show names only, while a styled tooltip presents parameter names, types, and consistent per-parameter colors.",
  
    history: [
      { when: "2026/11/15 09:35", text: "in the class diagram - method's text is NOT displayed as is. instead only the name of parameters is displayed and the type is displayed when hovering over the name (tooltip style)." },
      { when: "2026/11/15 09:35", text: "graph visual changes:\n1) classbox top bar (with the name) has to much bottom padding - should be a tighter bar vertically.\n2) the partial class \"Class\" classbox only contains its name - which is the right way, but the bg color/styl should be as for the name bar in a regular (with methods) classbox - it's a classbox with no methods textbox area.\n3) for each method line in the classbox method area - only put the method name. tooltip (when hovering) will contain show full method signature, but with param names and not types. instead types will be listed below, i.e.:\n  addClass(name, publicMethods)\n  -name: string\n  -publicMethods: string[]\n4) the OWNS line should not be listed in thevisual\n5) the name of the member variable for the OWNS classes: Class[] should be on the connector to Class\n6) since this is a OWNS relatiobnship the connector needs to start with a filled diamond (uml standard notation for ownership)" },
      { when: "2026/11/15 09:35", text: "this all looks good - but i want the tooltips to be more stylish - the method line in bold, different color for parantheses, different color per argument which is again used when noting that argument;s type in the lines below." },
    ],
  },
};
export function registerMethodSignaturesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const source: "Diagram\n  f(name: string, items: string[])\n  g(count: integer)\n  empty()\nOWNS classes: Class[]" =
      "Diagram\n  f(name: string, items: string[])\n  g(count: integer)\n  empty()\nOWNS classes: Class[]";
    await page.getByRole("textbox", { name: "Diagram text" }).fill(source);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-class-name="Diagram"]') !== null,
    );
    {
      const __entryValues: readonly (
        | readonly ["f", "f(name, items)\n-name: string\n-items: ✏️string[]"]
        | readonly ["g", "g(count)\n-count: integer"]
        | readonly ["empty", "empty()"]
      )[] = [
        ["f", "f(name, items)\n-name: string\n-items: ✏️string[]"],
        ["g", "g(count)\n-count: integer"],
        ["empty", "empty()"],
      ] as const;
      for (
        let __entryIndex: number = 0;
        __entryIndex < __entryValues.length;
        __entryIndex += 1
      ) {
        const [name, tooltip]:
          | readonly ["f", "f(name, items)\n-name: string\n-items: ✏️string[]"]
          | readonly ["g", "g(count)\n-count: integer"]
          | readonly ["empty", "empty()"] = __entryValues[__entryIndex]!;
        const method: import("playwright").Locator = page.locator(
          `[data-class-name="Diagram"] [data-method-tooltip^="${name}("]`,
        );
        await method.hover();
        assert.equal(await method.getAttribute("data-method-tooltip"), tooltip);
        await page.getByRole("tooltip").waitFor();
        assert.ok((await page.getByRole("tooltip").innerText()).includes(name));
      }
    }
    const first: import("playwright").Locator = page.locator(
      '[data-class-name="Diagram"] [data-method-tooltip^="f("]',
    );
    await first.hover();
    const styles: {
      readonly weight: string;
      readonly parentheses: string;
      readonly names: readonly string[];
      readonly details: readonly string[];
      readonly text: string;
    } = await page.getByRole("tooltip").evaluate(
      (
        element: HTMLElement,
      ) => {
        const signature: ReturnType<HTMLElement["querySelector"]> =
          element.querySelector<HTMLElement>(".tooltip-signature");
        if (!signature)
          window.logAndThrow(new Error("Expected a tooltip signature."));
        const parentheses: ReturnType<HTMLElement["querySelector"]> =
          signature.querySelector<HTMLElement>(".tooltip-paren");
        if (!parentheses)
          window.logAndThrow(new Error("Expected tooltip parentheses."));
        const signatureNames: HTMLElement[] = [
          ...signature.querySelectorAll<HTMLElement>(
            '[class^="argument-color-"]',
          ),
        ];
        const detailNames: HTMLElement[] = [
          ...element.querySelectorAll<HTMLElement>(
            '.tooltip-parameter [class^="argument-color-"]',
          ),
        ];
        return {
          weight: getComputedStyle(signature).fontWeight,
          parentheses: getComputedStyle(parentheses).color,
          names: signatureNames.map(
            (name: HTMLElement) => getComputedStyle(name).color,
          ),
          details: detailNames.map(
            (name: HTMLElement) => getComputedStyle(name).color,
          ),
          text: element.innerText,
        };
      },
    );
    assert.ok(Number(styles.weight) >= 700, "signature is bold");
    assert.notEqual(
      styles.parentheses,
      styles.names[0],
      "parentheses have a distinct color",
    );
    assert.notEqual(
      styles.names[0],
      styles.names[1],
      "arguments have distinct colors",
    );
    assert.deepEqual(
      styles.names,
      styles.details,
      "argument colors match their type lines",
    );
    assert.ok(styles.text.includes("string[]"));
    await page.mouse.move(2, 2);
    assert.equal(
      await page.getByRole("tooltip").count(),
      0,
      "tooltip closes after leaving",
    );
    await first.focus();
    await page.getByRole("tooltip").waitFor();
    assert.equal(
      await first.getAttribute("aria-describedby"),
      "method-tooltip",
    );
    assert.ok(
      (
        (await page
          .getByRole("textbox", { name: "Diagram text" })
          .textContent()) ?? ""
      ).includes("items: string[]"),
    );
    const seven: string = Array.from(
      { length: 7 },
      (_, index) => `arg${index}: string`,
    ).join(", ");
    await page
      .getByRole("textbox", { name: "Diagram text" })
      .fill(`Palette\n  f(${seven})\nOWNS classes: Class[]`);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-class-name="Palette"]') !== null,
    );
    await page
      .locator('[data-class-name="Palette"] [data-method-tooltip^="f("]')
      .hover();
    const colors: readonly string[] = await page
      .getByRole("tooltip")
      .locator('.tooltip-signature [class^="argument-color-"]')
      .evaluateAll((elements: readonly HTMLElement[]) =>
        elements.map(
          (element: HTMLElement) => getComputedStyle(element).color,
        ),
      );
    assert.equal(
      new Set(colors).size,
      7,
      "colors remain distinct beyond six arguments",
    );
  });
}
