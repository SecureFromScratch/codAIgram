import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { ClassDetails } from "../../../../dist/memory-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "loads every class when the Classes page is selected",
  prompt: {
    availability: "available",
    text: "When Classes is selected, fetch every class through getClasses and render all returned class boxes rather than requesting only ClassDiagram and Class.",
  },
};

const ALL_CLASSES: readonly ClassDetails[] = [
  {
    name: "AuditTrail",
    methods: [{ name: "recalcLayout", overloads: [[]] }],
    relations: [{
      kind: "OWNS",
      name: "events",
      target: "AuditEvent",
      many: true,
    }],
    isPartial: false,
  },
  {
    name: "AuditEvent",
    methods: [],
    relations: [],
    isPartial: true,
  },
  {
    name: "AuditSink",
    methods: [{ name: "record", overloads: [[]] }],
    relations: [],
    isPartial: false,
  },
];

export function registerStartupLoadsDiagramCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    let getClassesRequestCount: number = 0;
    await page.route("**/api/getClasses", async (route) => {
      getClassesRequestCount += 1;
      await route.fulfill({ json: ALL_CLASSES });
    });
    try {
      const request: Promise<import("playwright").Request> = page.waitForRequest(
        (requestValue) => requestValue.url().endsWith("/api/getClasses") && requestValue.method() === "GET",
      );
      await page.reload();
      await request;
      await page.getByRole("tab", { name: "Tests" }).click();
      await page.getByRole("tab", { name: "Classes" }).click();
      await page.locator(".joint-type-standard-headeredrectangle").waitFor();
      assert.equal(getClassesRequestCount, 1);
      const classNames: readonly string[] = ALL_CLASSES.map((item: ClassDetails) => item.name);
      const classBoxWaits: readonly Promise<void>[] = classNames.map((className: string) => page.locator(`[data-class-name="${className}"]`).waitFor());
      await Promise.all(classBoxWaits);
      const editorText: Awaited<ReturnType<import("playwright").Locator["textContent"]>> = await page
        .getByRole("textbox", { name: "Diagram text" })
        .textContent();
      assert.ok(editorText?.includes("recalcLayout()"));
    } finally {
      await page.unroute("**/api/getClasses");
    }
  });
}
