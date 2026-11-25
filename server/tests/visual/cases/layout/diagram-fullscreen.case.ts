import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { diagramBounds, type PanelBoundsT } from "./diagram-fullscreen-support.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "expands the diagram panel to fill the screen",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/18 09:35", text: "on the diagram panel - add a [ ] button at the top right.\nthen add tests: clicking toggle the diagram panel between current view and full screen view.", },
    ],
  },
};

export function registerDiagramFullscreenCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const toggle: Locator = page.getByRole("button", { name: "Expand diagram to full screen", });
    await toggle.waitFor();
    await toggle.click();
    await page
      .getByRole("button", { name: "Exit full screen diagram" })
      .waitFor();

    const bounds: PanelBoundsT = await diagramBounds();
    assert.ok(Math.abs(bounds.left) <= 1);
    assert.ok(Math.abs(bounds.top) <= 1);
    assert.ok(Math.abs(bounds.width - bounds.viewportWidth) <= 1);
    assert.ok(Math.abs(bounds.height - bounds.viewportHeight) <= 1);
  });
}
