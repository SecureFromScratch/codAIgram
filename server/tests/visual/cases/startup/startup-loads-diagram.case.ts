import assert from "node:assert/strict";
import { test } from "node:test";
import { page, setVisualClasses } from "../../test-support.js";
import type { ClassDetails } from "../../../../dist/memory-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: {
      when: string;
      text: string;
    }[];
  };
} = {
  title: "loads every class when the Classes page is selected",
  prompt: {
    availability: "available",
    old: "When Classes is selected, fetch every class through getClasses and render all returned class boxes rather than requesting only ClassDiagram and Class.",
  
    history: [
      { when: "2026/11/15 09:35", text: "change client tests for classes - they should choose the classes page and see that ALL classes are fetched, not just specific classes (now it's only \"Class\", \"ClassDiagram\")" },
      { when: "2026/11/15 09:35", text: "with current workbench classes returned by server the client in classes-page does not display the classes graph - instead it displays \"Could not load class details. Check that the server is running and reload.\".\n1) ensure server/emulator/client in tests do not use same port numbers as used by workbench\n2) ensure this is not the case in the visual tests. if yes - add tests expecting a class graph." },
    ],
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
    
  },
  {
    name: "AuditEvent",
    methods: [],
    relations: [],
    state: 'partial',
  },
  {
    name: "AuditSink",
    methods: [{ name: "record", overloads: [[]] }],
    relations: [],
    
  },
];

export function registerStartupLoadsDiagramCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    let getClassesRequestCount: number = 0;
    await setVisualClasses(ALL_CLASSES);
    const countRequest: (requestValue: import("playwright").Request) => void = (requestValue) => {
      if (requestValue.url().endsWith("/api/mock-project/getClasses") && requestValue.method() === "GET") getClassesRequestCount += 1;
    };
    page.on("request", countRequest);
    try {
      const request: Promise<import("playwright").Request> = page.waitForRequest(
        (requestValue) => requestValue.url().endsWith("/api/mock-project/getClasses") && requestValue.method() === "GET",
      );
      await page.reload();
      await request;
      await page.getByRole("tab", { name: "Tests" }).click();
      await page.getByRole("tab", { name: "Classes" }).click();
      await page.locator('[data-class-name="AuditTrail"]').waitFor();
      assert.equal(getClassesRequestCount, 1);
      const classNames: readonly string[] = ALL_CLASSES.map((item: ClassDetails) => item.name);
      const classBoxWaits: readonly Promise<void>[] = classNames.map((className: string) => page.locator(`[data-class-name="${className}"]`).waitFor());
      await Promise.all(classBoxWaits);
      await page.evaluate(() => {
        const app: { selectClass: (name: string) => void } | undefined =
          (window as Window & { __app?: { selectClass: (name: string) => void } }).__app;
        if (!app) throw new Error("Application command hook is unavailable.");
        app.selectClass("AuditTrail");
      });
      await page.waitForFunction(
        () => document.querySelector(".cm-content")?.textContent?.includes("recalcLayout()") === true,
      );
      const editorText: Awaited<ReturnType<import("playwright").Locator["textContent"]>> = await page
        .getByRole("textbox", { name: "Diagram text" })
        .textContent();
      assert.ok(editorText?.includes("recalcLayout()"));
    } finally {
      page.off("request", countRequest);
    }
  });
}
