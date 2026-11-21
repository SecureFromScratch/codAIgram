import assert from "node:assert/strict";
import type { Locator, Route } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "shows NO PROJECT and only New project when getProjects is empty",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/19 09:35", text: "If getProjects returns an empty list, the project combobox shows NO PROJECT, and opening its arrow shows only the New project option." }],
  },
};

export function registerProjectEmptyListCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const routePattern: string = "**/api/getProjects";
    await page.route(routePattern, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    try {
      await page.reload();
      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      const noProjectLabel: Locator = page.locator(".project-no-project-label");
      await noProjectLabel.waitFor({ state: "visible" });
      assert.equal(await noProjectLabel.textContent(), "NO PROJECT");
      assert.deepEqual(await selector.locator("option").allTextContents(), ["New project"]);

      await selector.click();
      await selector.selectOption({ label: "New project" });
      await page.getByRole("dialog", { name: "New project" }).waitFor({ state: "visible" });
    } finally {
      await page.unroute(routePattern);
    }
  });
}
