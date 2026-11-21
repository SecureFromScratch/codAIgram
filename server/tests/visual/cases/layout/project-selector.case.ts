import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

type LocatorBoundsT = Awaited<ReturnType<Locator["boundingBox"]>>;

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "shows the current project selector before the chat toggle with all projects and New project",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "At the top right of the top bar, left of the chat panel toggle, show a combobox with the current project, all projects, and New project last." }],
  },
};

export function registerProjectSelectorCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const selector: Locator = page.getByRole("combobox", { name: "Current project" });
    const toggle: Locator = page.getByRole("button", { name: "Toggle chat panel" });
    await selector.waitFor();
    assert.equal(await selector.inputValue(), "mock-project");
    assert.deepEqual(await selector.locator("option").allTextContents(), [
      "another",
      "mock-project",
      "New project",
    ]);
    const selectorBounds: LocatorBoundsT = await selector.boundingBox();
    const toggleBounds: LocatorBoundsT = await toggle.boundingBox();
    assert.ok(selectorBounds);
    assert.ok(toggleBounds);
    assert.equal(selectorBounds.y, toggleBounds.y);
    assert.ok(selectorBounds.x + selectorBounds.width <= toggleBounds.x);
  });
}
