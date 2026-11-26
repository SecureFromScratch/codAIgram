import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import type { ClassDetails } from "../../../../dist/memory-repository.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { page, setVisualClasses } from "../../test-support.js";

const REGULAR_CLASS_NAME: string = "RegularTooltipClass";
const PARTIAL_CLASS_NAME: string = "PartialTooltipClass";
const PARTIAL_CLASS_WITHOUT_SOURCE_NAME: string = "PartialClassWithoutSourceMetadata";

const CLASSES: readonly ClassDetails[] = [
  {
    name: REGULAR_CLASS_NAME,
    methods: [],
    relations: [],
    sourceFile: "src/regular-tooltip-class.ts",
    modifiedAt: "2026-11-20T10:00:00.000Z",
  },
  {
    name: PARTIAL_CLASS_NAME,
    methods: [],
    relations: [],
    state: "partial",
    sourceFile: "src/partial-tooltip-class.ts",
    modifiedAt: "2026-11-21T11:30:00.000Z",
  },
  {
    name: PARTIAL_CLASS_WITHOUT_SOURCE_NAME,
    methods: [],
    relations: [],
    state: "partial",
  },
];

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "shows the class source tooltip when hovering over a partial class name",
  prompt: {
    availability: "available",
    history: [
      {
        when: "2026/11/25 00:00",
        text: "add a visual test - hovering over a partial class shows the same kind of tooltip as hovering over the name of a classbox.",
      },
    ],
  },
};

export function registerPartialClassTooltipCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(CLASSES);
    await page.reload();

    const regularTooltip: string = await readNameTooltip(REGULAR_CLASS_NAME);
    const partialTooltip: string = await readNameTooltip(PARTIAL_CLASS_NAME);
    const partialWithoutSourceTooltip: string = await readNameTooltip(PARTIAL_CLASS_WITHOUT_SOURCE_NAME);

    assert.equal(regularTooltip, `${REGULAR_CLASS_NAME}\nFile: src/regular-tooltip-class.ts\nModified: 2026-11-20T10:00:00.000Z`);
    assert.equal(partialTooltip, `${PARTIAL_CLASS_NAME}\nFile: src/partial-tooltip-class.ts\nModified: 2026-11-21T11:30:00.000Z`);
    assert.equal(partialWithoutSourceTooltip, PARTIAL_CLASS_WITHOUT_SOURCE_NAME);
    assert.equal(partialTooltip.split("\n").length, regularTooltip.split("\n").length);
  });
}

async function readNameTooltip(className: string): Promise<string> {
  const classNameLocator: Locator = page.locator(`[data-class-name="${className}"] text[joint-selector="headerText"], [data-class-name="${className}"] text[joint-selector="label"]`);
  await classNameLocator.hover();
  const tooltip: Locator = page.getByRole("tooltip");
  await tooltip.waitFor();
  return tooltip.innerText();
}
