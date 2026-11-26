import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { logAndThrow } from "../../logging.js";
type RectangleT = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};
type TextRowT = {
  readonly text: Node["textContent"];
  readonly rect: RectangleT;
};
type DiagramTextT = {
  readonly heading: Node["textContent"];
  readonly headingRect: RectangleT;
  readonly headerRect: RectangleT;
  readonly rows: readonly TextRowT[];
  readonly sourceRect: RectangleT;
  readonly target: Node["textContent"];
  readonly targetRect: RectangleT;
  readonly targetBoxRect: RectangleT;
  readonly marker: readonly Node["textContent"][];
};
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title:
    "keeps diagram text on one line per item, fitting or ending in an ellipsis",
  prompt: {
    availability: "available",
    old: "All text in the diagram must either fit on one line or end in an ellipsis; it must not wrap.",
  
    history: [
      { when: "2026/11/15 09:35", text: "add a test on all the text in the diagram - no text line wraps - they either fit or have an elipsis" },
    ],
  },
};
async function inspectDiagramText(
  headingName: string,
  expectedTarget: string,
): Promise<DiagramTextT> {
  return page.evaluate(({ heading: expectedClassName, targetName }) => {
    const source: Element | undefined = [...document.querySelectorAll(
      ".joint-type-standard-headeredrectangle",
    )].find((item: Element) => item.getAttribute("data-class-name") === expectedClassName);
    const target: Element | undefined = [...document.querySelectorAll(
      ".joint-type-standard-rectangle",
    )].find((item: Element) => item.getAttribute("data-class-name") === targetName);
    if (!source || !target)
      window.logAndThrow(new Error("Expected both class boxes."));
    const heading: SVGTextElement = source.querySelectorAll("text").item(0);
    const body: SVGTextElement = source.querySelectorAll("text").item(1);
    const targetText: ReturnType<Element["querySelector"]> = target.querySelector("text");
    const header: SVGRectElement = source.querySelectorAll("rect").item(1);
    const sourceBox: ReturnType<Element["querySelector"]> = source.querySelector("rect");
    const targetBox: ReturnType<Element["querySelector"]> = target.querySelector("rect");
    if (
      !heading ||
      !body ||
      !targetText ||
      !header ||
      !sourceBox ||
      !targetBox
    )
      window.logAndThrow(new Error("Diagram text or bounds are missing."));
    const rows: TextRowT[] = [...body.querySelectorAll(":scope > tspan")].map(
      (row: Element) => ({
        text: row.textContent,
        rect: row.getBoundingClientRect(),
      }),
    );
    return {
      heading: heading.textContent,
      headingRect: heading.getBoundingClientRect(),
      headerRect: header.getBoundingClientRect(),
      rows,
      sourceRect: sourceBox.getBoundingClientRect(),
      target: targetText.textContent,
      targetRect: targetText.getBoundingClientRect(),
      targetBoxRect: targetBox.getBoundingClientRect(),
      marker: [...document.querySelectorAll(".joint-link text")].map(
        (text: Element) => text.textContent,
      ),
    };
  }, { heading: headingName, targetName: expectedTarget });
}
function fitsOrIsEllipsized(shown: Node["textContent"], full: string): boolean {
  return (
    shown === full ||
    (shown?.endsWith("…") === true && full.startsWith(shown.slice(0, -1)))
  );
}
async function verifyText(
  expectedHeading: string,
  expectedMembers: readonly string[],
  expectedTarget: string,
): Promise<void> {
  const actual: DiagramTextT = await inspectDiagramText(
    expectedHeading,
    expectedTarget,
  );
  assert.ok(
    fitsOrIsEllipsized(actual.heading, expectedHeading),
    "heading is complete or ellipsized",
  );
  assert.equal(
    actual.rows.length,
    expectedMembers.length,
    "each source line has exactly one visual line",
  );
  {
    const __entryValues: readonly [number, string][] = Array.from(
      expectedMembers.entries(),
    );
    for (
      let __entryIndex: number = 0;
      __entryIndex < __entryValues.length;
      __entryIndex += 1
    ) {
      const [index, expected]: [number, string] = __entryValues[__entryIndex]!;
      const row: TextRowT | undefined = actual.rows[index];
      if (!row) logAndThrow(new Error("Expected text row."));
      assert.ok(
        fitsOrIsEllipsized(row.text, expected),
        `source line ${index + 1} is complete or ellipsized`,
      );
      assert.ok(
        row.rect.left >= actual.sourceRect.left &&
          row.rect.right <= actual.sourceRect.right,
        `source line ${index + 1} fits`,
      );
    }
  }
  assert.ok(
    fitsOrIsEllipsized(actual.target, expectedTarget),
    "target name is complete or ellipsized",
  );
  assert.ok(
    actual.headingRect.left >= actual.headerRect.left &&
      actual.headingRect.right <= actual.headerRect.right,
    "heading fits",
  );
  assert.ok(
    actual.targetRect.left >= actual.targetBoxRect.left &&
      actual.targetRect.right <= actual.targetBoxRect.right,
    "target fits",
  );
  assert.ok(
    actual.marker.includes("classes") && actual.marker.includes("*"),
    "relationship name and multiplicity remain visible",
  );
}
export function registerTextEllipsisCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await verifyText(
      "ClassDiagram",
      ["addClass()", "addPartialClass()", "connectClasses()", "recalcLayout()"],
      "Class",
    );
    const heading: string =
      "VeryWideClassDiagramNameWithManyCharacters";
    const member: string =
      "anExtremelyLongMethodNameWithArguments(name: string)";
    const target: string =
      "AnotherVeryLongTargetClassName";
    await page
      .getByRole("textbox", { name: "Diagram text" })
      .fill(`${heading}\n  ${member}\nOWNS classes: ${target}[]`);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".joint-type-standard-headeredrectangle")].some(
          (element: Element) => element.getAttribute("data-class-name") === "VeryWideClassDiagramNameWithManyCharacters",
        ),
    );
    assert.ok(
      (
        (await page
          .getByRole("textbox", { name: "Diagram text" })
          .textContent()) ?? ""
      ).includes(member),
      "editor preserves the full source",
    );
    await verifyText(
      heading,
      ["anExtremelyLongMethodNameWithArguments()"],
      target,
    );
  });
}
