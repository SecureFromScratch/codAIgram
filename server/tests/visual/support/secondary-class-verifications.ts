import assert from "node:assert/strict";
import { page } from "../test-support.js";
import { assertRedWavyError } from "./method-support.js";
import {
  isolateSecondaryClass,
  type SecondaryClassFixtureT,
} from "./secondary-class-support.js";
export async function verifySecondaryClassStructure(
  fixture: SecondaryClassFixtureT,
): Promise<void> {
  const { editor }: Awaited<ReturnType<typeof isolateSecondaryClass>> =
    await isolateSecondaryClass(fixture.name);
  assert.equal(await editor.locator(".dsl-error").count(), 0);
  assert.equal(
    await editor.locator(".dsl-class-name").innerText(),
    fixture.name,
  );
  assert.equal(await page.locator("[data-eye-badge]").count(), 1);
  const geometry: {
    body: any;
    header: any;
    title: any;
    contents: any;
    titleText: string;
    rows: { text: string; rect: any; }[];
  } = await page
    .locator(`[data-class-name="${fixture.name}"]`)
    .evaluate((element: Element) => {
      const body: SVGRectElement = element.querySelectorAll("rect").item(0);
      const header: SVGRectElement = element.querySelectorAll("rect").item(1);
      const title: SVGTextElement = element.querySelectorAll("text").item(0);
      const contents: SVGTextElement = element.querySelectorAll("text").item(1);
      if (
        !body ||
        !header ||
        !title ||
        !contents
      )
        throw new Error("Expected a complete class box.");
      return {
        body: body.getBoundingClientRect().toJSON(),
        header: header.getBoundingClientRect().toJSON(),
        title: title.getBoundingClientRect().toJSON(),
        contents: contents.getBoundingClientRect().toJSON(),
        titleText: title.textContent,
        rows: [...contents.querySelectorAll(":scope > tspan")].map(
          (row: Element) => ({
            text: row.textContent,
            rect: row.getBoundingClientRect().toJSON(),
          }),
        ),
      };
    });
  assert.equal(geometry.titleText, fixture.name);
  assert.ok(geometry.body.width <= 200);
  assert.ok(
    geometry.title.top >= geometry.header.top &&
      geometry.title.bottom <= geometry.header.bottom,
  );
  assert.ok(
    geometry.contents.top >= geometry.header.bottom &&
      geometry.contents.bottom <= geometry.body.bottom,
  );
  assert.equal(geometry.rows.length, fixture.members.length);
  {
    const __entryValues: readonly [number, string][] = Array.from(
      fixture.members.entries(),
    );
    for (
      let __entryIndex: number = 0;
      __entryIndex < __entryValues.length;
      __entryIndex += 1
    ) {
      const [index, expected]: [number, string] = __entryValues[__entryIndex]!;
      const row:
        | { text: string; rect: any; }
        | undefined = geometry.rows[index];
      if (!row) throw new Error("Expected class member row.");
      assert.ok(
        row.text === expected ||
          ((row.text ?? "").endsWith("…") &&
            expected.startsWith((row.text ?? "").slice(0, -1))),
      );
      assert.ok(
        row.rect.left >= geometry.body.left &&
          row.rect.right <= geometry.body.right,
      );
    }
  }
}
export async function verifySecondaryClassPropertyEdits(
  fixture: SecondaryClassFixtureT,
): Promise<void> {
  const {
    editor,
    selected,
  }: Awaited<ReturnType<typeof isolateSecondaryClass>> =
    await isolateSecondaryClass(fixture.name);
  const property: "by: string" | "modifications : Modification[]" =
    fixture.name === "Modification"
      ? "by: string"
      : "modifications : Modification[]";
  await editor.fill(selected.source.replace(property, "updated: boolean"));
  await page.waitForFunction(
    (name: string) =>
      document
        .querySelector(`[data-class-name="${name}"]`)
        ?.textContent?.includes("updated: boolean") === true,
    fixture.name,
  );
  assert.equal(
    await page.locator('[data-class-name="ClassDiagram"]').count(),
    1,
  );
  await editor.fill(selected.source.replace(property, "updated boolean"));
  await assertRedWavyError(editor, "updated boolean");
  await editor.fill(selected.source.replace(property, "updated:"));
  await assertRedWavyError(editor, "updated:");
  await editor.fill(selected.source.replace(/^\w+/, `${fixture.name}Renamed`));
  await page.locator(`[data-class-name="${fixture.name}Renamed"]`).waitFor();
  await editor.fill(selected.source.replace(/^\w+/, ""));
  await editor.locator(".dsl-missing-class").waitFor();
}
export async function verifySecondaryClassMethodEdits(
  fixture: SecondaryClassFixtureT,
): Promise<void> {
  const {
    editor,
    selected,
  }: Awaited<ReturnType<typeof isolateSecondaryClass>> =
    await isolateSecondaryClass(fixture.name);
  const original: string = `${selected.source}\n  inspect(value: string)`;
  await editor.fill(original);
  const box: import("playwright").Locator = page.locator(
    `[data-class-name="${fixture.name}"]`,
  );
  await page.waitForFunction(
    (name: string) =>
      document
        .querySelector(`[data-class-name="${name}"]`)
        ?.textContent?.includes("inspect") === true,
    fixture.name,
  );
  await editor.fill(
    original.replace(
      "inspect(value: string)",
      "review(label: number, active: boolean)",
    ),
  );
  const method: import("playwright").Locator = box.locator(
    '[data-method-tooltip^="review("]',
  );
  await method.waitFor();
  assert.equal(
    await method.getAttribute("data-method-tooltip"),
    "review(label, active)\n-label: number\n-active: boolean",
  );
  await method.hover();
  await page.getByRole("tooltip").waitFor();
  const current: string = original.replace(
    "inspect(value: string)",
    "review(label: number, active: boolean)",
  );
  await editor.fill(current.replace("  review", " review"));
  await assertRedWavyError(editor, "review(label: number, active: boolean)");
  await editor.fill(
    current.replace(
      "review(label: number, active: boolean)",
      "review(label number)",
    ),
  );
  await assertRedWavyError(editor, "review(label number)");
  await editor.fill(current);
  const line: import("playwright").Locator = editor
    .locator(".cm-line")
    .filter({ hasText: "review(label: number, active: boolean)" });
  await line.click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.press("Backspace");
  await page.waitForFunction(
    (name: string) =>
      document
        .querySelector(`[data-class-name="${name}"]`)
        ?.textContent?.includes("review") !== true,
    fixture.name,
  );
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    (expected: string) =>
      [...document.querySelectorAll(".cm-content .cm-line")]
        .map((item: Element) => item.textContent)
        .join("\n") === expected,
    current,
  );
  await box.locator('[data-method-tooltip^="review("]').waitFor();
}
export async function verifySecondaryClassOwnershipEdits(
  fixture: SecondaryClassFixtureT,
): Promise<void> {
  const {
    editor,
    selected,
  }: Awaited<ReturnType<typeof isolateSecondaryClass>> =
    await isolateSecondaryClass(fixture.name);
  const relationship: string = `${selected.source}\nOWNS entries: Entry[]`;
  await editor.fill(relationship);
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".joint-link text")].some(
      (item: Element) => item.textContent === "entries",
    ),
  );
  assert.equal(await page.locator('[data-class-name="Entry"]').count(), 1);
  assert.equal(await page.locator(".joint-link").count(), 2);
  await editor.fill(relationship.replace("Entry[]", "Entry"));
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".joint-link")].some(
      (link: Element) =>
        [...link.querySelectorAll("text")]
          .map((item: Element) => item.textContent)
          .join("|") === "entries",
    ),
  );
  await editor.fill(relationship.replace("entries: Entry[]", "Entry[]"));
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll(".joint-link text")].some(
        (item: Element) => item.textContent === "entries",
      ),
  );
  assert.equal(await page.locator(".joint-link").count(), 2);
  await editor.fill(
    relationship.replace("OWNS entries: Entry[]", "OWX entries: Entry[]"),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".joint-link").length === 1,
  );
  await assertRedWavyError(editor, "entries: Entry[]");
  await editor.fill(relationship);
  await page.waitForFunction(
    () => document.querySelectorAll(".joint-link").length === 2,
  );
  await editor.fill(relationship.replace("Entry[]", ""));
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".joint-type-standard-rectangle text")].some(
      (item: Element) => item.textContent === "?",
    ),
  );
  await editor.fill(relationship);
  await page.waitForFunction(
    () => document.querySelectorAll(".joint-link").length === 2,
  );
  await editor.fill(selected.source);
  await page.waitForFunction(
    () => document.querySelectorAll(".joint-link").length === 1,
  );
  assert.equal(await page.locator('[data-class-name="Entry"]').count(), 0);
}
export async function verifySecondaryClassTooltipEdges(
  fixture: SecondaryClassFixtureT,
): Promise<void> {
  const {
    editor,
    selected,
  }: Awaited<ReturnType<typeof isolateSecondaryClass>> =
    await isolateSecondaryClass(fixture.name);
  await editor.fill(`${selected.source}\n  inspect(value: string)`);
  await page.setViewportSize({ width: 1600, height: 440 });
  try {
    {
      const __edgeValues: readonly ("top" | "bottom")[] = [
        "top",
        "bottom",
      ] as const;
      for (
        let __edgeIndex: number = 0;
        __edgeIndex < __edgeValues.length;
        __edgeIndex += 1
      ) {
        const edge: "top" | "bottom" = __edgeValues[__edgeIndex]!;
        await page.locator(".canvas").evaluate(
          (
            canvas: Element,
            input: { readonly name: string; readonly side: "top" | "bottom"; },
          ) => {
            const rectangle: ReturnType<Element["querySelector"]> = canvas.querySelector(
              `[data-class-name="${input.name}"] rect`,
            );
            if (!rectangle)
              throw new Error("Expected secondary class box.");
            const box: DOMRect = rectangle.getBoundingClientRect();
            const panel: DOMRect = canvas.getBoundingClientRect();
            canvas.scrollTop +=
              input.side === "top"
                ? box.top - panel.top - 2
                : box.bottom - panel.bottom + 2;
          },
          { name: fixture.name, side: edge },
        );
        await page
          .locator(
            `[data-class-name="${fixture.name}"] [data-method-tooltip^="inspect("]`,
          )
          .hover();
        const tooltip: import("playwright").Locator = page.getByRole("tooltip");
        await tooltip.waitFor();
        const fits: boolean = await tooltip.evaluate(
          (element: HTMLElement) => {
            const panel: ReturnType<Element["closest"]> = element.closest(".graph-pane");
            if (!panel) throw new Error("Expected graph pane.");
            const tip: DOMRect = element.getBoundingClientRect();
            const panelBounds: DOMRect = panel.getBoundingClientRect();
            return (
              tip.top >= panelBounds.top &&
              tip.bottom <= panelBounds.bottom &&
              tip.left >= panelBounds.left &&
              tip.right <= panelBounds.right &&
              tip.top >= 0 &&
              tip.bottom <= window.innerHeight &&
              tip.left >= 0 &&
              tip.right <= window.innerWidth &&
              element.scrollHeight <= element.clientHeight + 1
            );
          },
        );
        assert.ok(fits, `tooltip fits at the ${edge} edge`);
        assert.ok(((await tooltip.textContent()) ?? "").includes("value"));
        await page.mouse.move(2, 2);
      }
    }
  } finally {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.locator(".canvas").evaluate((element: Element) => {
      element.scrollTop = 0;
    });
  }
}
