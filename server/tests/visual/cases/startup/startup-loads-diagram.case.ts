import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "loads diagram details and fills the editor at startup",
  prompt: {
    availability: "available",
    text: "On client startup request ClassDiagram and Class details, then render their DSL text in the editor.",
  },
};
export function registerStartupLoadsDiagramCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const request: Promise<import("playwright").Request> = page.waitForRequest(
      (requestValue) =>
        requestValue.url().endsWith("/api/classesDetails") &&
        requestValue.method() === "POST",
    );
    await page.reload();
    assert.deepEqual((await request).postDataJSON(), { classNames: ["ClassDiagram", "Class"], });
    await page.locator(".joint-type-standard-headeredrectangle").waitFor();
    const editorText: Awaited<ReturnType<import("playwright").Locator["textContent"]>> = await page
      .getByRole("textbox", { name: "Diagram text" })
      .textContent();
    assert.ok(
      editorText?.includes(
        "connectClasses(from: string, to: string, connectionType: ConnectionType, arity: integer)",
      ),
    );
    assert.ok(editorText?.includes("OWNS classes: Class[]"));
  });
}
