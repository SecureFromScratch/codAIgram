import assert from "node:assert/strict";
import type { Request, Route } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

const FIRST_PROJECT_NAME: string = "first-returned-project";
const PREVIOUSLY_SELECTED_PROJECT_NAME: string = "previously-selected-project";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "restores the previously selected project for initial class and test requests after reload",
  prompt: {
    availability: "available",
    history: [
      {
        when: "2026/11/25 00:00",
        text: "I have a production problem - when i reload the client in the browser it sends an initial getClasses/getTests with the wrong test id in the url. I do not want this fixed yet - I want a test that detectes this in the test suite and fails red.",
      },
    ],
  },
};

export function registerInitialProjectRequestIdsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await page.route("**/api/getProjects", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([FIRST_PROJECT_NAME, PREVIOUSLY_SELECTED_PROJECT_NAME]),
      });
    });

    try {
      await page.evaluate((projectName: string) => {
        window.localStorage.setItem("codaigram.selectedProject", projectName);
      }, PREVIOUSLY_SELECTED_PROJECT_NAME);
      const classesRequest: Promise<Request> = page.waitForRequest((request: Request) => {
        const requestUrl: URL = new URL(request.url());
        return request.method() === "GET" && /\/api\/[^/]+\/getClasses$/u.test(requestUrl.pathname);
      });
      const testsRequest: Promise<Request> = page.waitForRequest((request: Request) => {
        const requestUrl: URL = new URL(request.url());
        return request.method() === "GET" && /\/api\/[^/]+\/getTests$/u.test(requestUrl.pathname);
      });

      await page.reload();
      const requests: readonly Request[] = await Promise.all([classesRequest, testsRequest]);
      const requestedPaths: readonly string[] = requests.map((request: Request) => new URL(request.url()).pathname);

      assert.deepEqual(
        Array.from(requestedPaths).sort(),
        [
          `/api/${PREVIOUSLY_SELECTED_PROJECT_NAME}/getClasses`,
          `/api/${PREVIOUSLY_SELECTED_PROJECT_NAME}/getTests`,
        ].sort(),
        `Initial inventory requests must use the previously selected project, even when it is not first in getProjects. Actual URLs: ${requests.map((request: Request) => request.url()).join(", ")}`,
      );
    } finally {
      await page.unroute("**/api/getProjects");
    }
  });
}
