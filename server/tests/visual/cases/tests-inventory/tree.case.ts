import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "displays persisted tests as a grouped tree without an editor",
  prompt: {
    availability: "available",
    text: "Add a Tests mode whose left pane displays test groups and cases from the persisted tests inventory, without a text editor.",
  },
};

export function registerTestsInventoryTreeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await page.getByRole("tab", { name: "Tests" }).click();
    assert.equal(await page.locator(".editor").count(), 0);
    assert.equal(await page.locator(".tree-group-label", { hasText: "diagram" }).count(), 1);
    assert.equal(await page.locator(".tree-group-label", { hasText: "repository" }).count(), 1);
    assert.equal(await page.locator(".test-case", { hasText: "renders-class" }).count(), 1);
    assert.equal(await page.locator(".test-case", { hasText: "stores-details" }).count(), 1);
    assert.equal(await page.locator(".tests-placeholder").count(), 1);
  });
}
