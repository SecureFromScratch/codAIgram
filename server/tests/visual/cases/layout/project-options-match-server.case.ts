import assert from "node:assert/strict";
import type { Locator, Route } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

const SERVER_PROJECTS: readonly [string, string] = ["ServerProjectAlpha", "ServerProjectBeta"];

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "shows only projects returned by getProjects",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/19 09:35", text: "Add a visual test verifying that the project combobox contains only the projects returned by the server's getProjects call." }],
  },
};

export function registerProjectOptionsMatchServerCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const routePattern: string = "**/api/getProjects";
    await page.route(routePattern, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SERVER_PROJECTS),
      });
    });
    try {
      await page.reload();
      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      const expectedOptions: string[] = [...SERVER_PROJECTS, "New project"];
      await page.getByRole("option", { name: SERVER_PROJECTS[1], exact: true }).waitFor({ state: "attached" });
      assert.deepEqual(await selector.locator("option").allTextContents(), expectedOptions);
      assert.equal(await selector.locator("option").filter({ hasText: "mock-project" }).count(), 0);
    } finally {
      await page.unroute(routePattern);
    }
  });
}
