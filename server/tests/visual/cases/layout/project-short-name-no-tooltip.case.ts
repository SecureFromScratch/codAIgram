import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "does not show a tooltip for a project name that fits in the combobox",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/19 09:35", text: "Hovering over a short project name that fits in the combobox must not show a tooltip.", },
    ],
  },
};

export function registerProjectShortNameNoTooltipCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const selector: Locator = page.getByRole("combobox", { name: "Current project" });
    await selector.waitFor();
    assert.equal(await selector.inputValue(), "mock-project");
    await selector.hover();
    assert.equal(await page.getByRole("tooltip").count(), 0);
  });
}
