import assert from "node:assert/strict";
import type { Locator, Response, Route } from "playwright";
import { test } from "node:test";
import { logAndThrow } from "../../logging.js";
import { page, setVisualClasses } from "../../test-support.js";
import type { ClassDetails } from "../../../../dist/memory-repository.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

const PROJECT_NAME: string = "mock-project";
const STARTUP_CLASS: ClassDetails = { name: "StartupVisibleClass", methods: [], relations: [], };

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "shows a class on startup when the selected project has classes",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/19 09:35", text: "Add a startup visual test: when getProjects returns at least one project and the first project is selected, if getClasses returns a non-empty collection, verify that at least one class appears in the graph." }],
  },
};

export function registerSelectedProjectShowsClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([STARTUP_CLASS]);
    await page.route("**/api/getProjects", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([PROJECT_NAME]),
      });
    });
    try {
      const projectsResponse: Promise<Response> = page.waitForResponse(
        (response: Response) => response.url().endsWith("/api/getProjects") && response.status() === 200,
      );
      const classesResponse: Promise<Response> = page.waitForResponse(
        (response: Response) => response.url().endsWith(`/api/${PROJECT_NAME}/getClasses`) && response.status() === 200,
      );
      await page.reload();

      const selector: Locator = page.getByRole("combobox", { name: "Current project" });
      await selector.getByRole("option", { name: PROJECT_NAME, exact: true }).waitFor({ state: "attached" });
      const projectOptions: string[] = await selector.locator("option").allTextContents();
      const firstProject: string | undefined = projectOptions.at(0);
      assert.equal(firstProject, PROJECT_NAME);
      await page.waitForFunction((name: string) => {
        return document.querySelector<HTMLSelectElement>('select[aria-label="Current project"]')?.value === name;
      }, PROJECT_NAME);
      assert.equal(await selector.inputValue(), PROJECT_NAME);
      await projectsResponse;

      const response: Response = await classesResponse;
      const responseBody: unknown = await response.json();
      if (typeof responseBody !== "object" || !responseBody || !("classes" in responseBody) || !Array.isArray(responseBody.classes)) {
        logAndThrow(new Error("getClasses returned an invalid response body."));
      }
      assert.ok(responseBody.classes.length > 0);
      await page.locator(".canvas [data-class-name]").first().waitFor({ state: "visible" });
      assert.ok(await page.locator(".canvas [data-class-name]").count() > 0);
    } finally {
      await page.unroute("**/api/getProjects");
    }
  });
}
