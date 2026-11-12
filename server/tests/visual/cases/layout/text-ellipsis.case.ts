import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
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
  prompt: { availability: string; text: string; };
} = {
  title:
    "keeps diagram text on one line per item, fitting or ending in an ellipsis",
  prompt: {
    availability: "available",
    text: "All text in the diagram must either fit on one line or end in an ellipsis; it must not wrap.",
  },
};
async function inspectDiagramText(): Promise<DiagramTextT> {
  return page.evaluate(() => {
    const source: ReturnType<Document["querySelector"]> = document.querySelector(
      ".joint-type-standard-headeredrectangle",
    );
    const target: ReturnType<Document["querySelector"]> = document.querySelector(
      ".joint-type-standard-rectangle",
    );
    if (!source || !target)
      throw new Error("Expected both class boxes.");
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
      throw new Error("Diagram text or bounds are missing.");
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
  });
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
  const actual: DiagramTextT = await inspectDiagramText();
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
      if (!row) throw new Error("Expected text row.");
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
  assert.deepEqual(actual.marker, ["classes", "*"]);
}
export function registerTextEllipsisCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await verifyText(
      "ClassDiagram",
      ["addClass", "addPartialClass", "connectClasses", "recalcLayout"],
      "Class",
    );
    const heading: "VeryWideClassDiagramNameWithManyCharacters" =
      "VeryWideClassDiagramNameWithManyCharacters";
    const member: "anExtremelyLongMethodNameWithArguments(name: string)" =
      "anExtremelyLongMethodNameWithArguments(name: string)";
    const target: "AnotherVeryLongTargetClassName" =
      "AnotherVeryLongTargetClassName";
    await page
      .getByRole("textbox", { name: "Diagram text" })
      .fill(`${heading}\n  ${member}\nOWNS classes: ${target}[]`);
    await page.waitForFunction(
      () =>
        document
          .querySelector(".joint-type-standard-headeredrectangle text")
          ?.textContent?.startsWith("VeryWide") === true,
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
      ["anExtremelyLongMethodNameWithArguments"],
      target,
    );
  });
}
