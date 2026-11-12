import assert from "node:assert/strict";
import { test } from "node:test";
import type { Locator } from "playwright";
import { page } from "../../test-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "edits OWNS, REF, and UNK connections in the class editor",
  prompt: {
    availability: "available",
    text: "Expand class editing so its DSL supports OWNS, REF, and UNK connections between classes.",
  },
};

export function registerRelationshipKindsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const source: string = "Source\nOWNS owned: Owned[]\nREF reference: Referenced\nUNK unknown: Unknown[]";
    const editor: Locator = page.getByRole("textbox", { name: "Diagram text" });
    await editor.fill(source);
    await page.waitForFunction(() => document.querySelectorAll("[data-class-name]").length === 4);
    assert.equal(await page.locator(".cm-content .dsl-ownership", { hasText: "OWNS" }).count(), 1);
    assert.equal(await page.locator(".cm-content .dsl-ownership", { hasText: "REF" }).count(), 1);
    assert.equal(await page.locator(".cm-content .dsl-ownership", { hasText: "UNK" }).count(), 1);
    assert.equal(await page.locator(".joint-link").count(), 3);
  });
}
