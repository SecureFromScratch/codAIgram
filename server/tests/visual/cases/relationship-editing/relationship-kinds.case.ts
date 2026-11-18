import assert from "node:assert/strict";
import { test } from "node:test";
import type { Locator } from "playwright";
import { page } from "../../test-support.js";

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
  title: "edits OWNS, REF, and UNK connections in the class editor",
  prompt: {
    availability: "available",
    old: "Expand class editing so its DSL supports OWNS, REF, and UNK connections between classes.",
  
    history: [
      { when: "2026/11/15 09:35", text: "in server api test - expand classesDetails/updateClasses test to test for the following connection type between classes:\nOWNS\nREF\nUNK\nalso expand these tests to code editor in classes editing page. and the supported dsl." },
    ],
  },
};

export function registerRelationshipKindsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const source: string = "Source\nOWNS owned: Owned[]\nREF reference: Referenced\nUNK unknown: Unknown[]";
    const editor: Locator = page.getByRole("textbox", { name: "Diagram text" });
    await editor.fill(source);
    await page.locator('.canvas [data-class-name="Source"]').waitFor();
    const sourceModel: unknown = await page.evaluate(() => {
      const app: { tryGetModel: (name: string) => { isOk: () => boolean; value?: unknown } } | undefined = (window as Window & { __app?: { tryGetModel: (name: string) => { isOk: () => boolean; value?: unknown } } }).__app;
      const result = app?.tryGetModel("Source");
      return result?.isOk() ? result.value : null;
    });
    assert.deepEqual(sourceModel, {
      name: "Source",
      methods: [],
      relations: [
        { kind: "OWNS", name: "owned", target: "Owned", many: true },
        { kind: "REF", name: "reference", target: "Referenced", many: false },
        { kind: "UNK", name: "unknown", target: "Unknown", many: true },
      ],
    });
    assert.ok((await page.locator(".canvas svg").count()) >= 1);
    const sourceBox: Locator = page.locator('.canvas [data-class-name="Source"]');
    assert.equal(await sourceBox.count(), 1);
    assert.equal(await sourceBox.locator("text").textContent(), "Source");
    const labels: string[] = await page.locator(".joint-link text").allTextContents();
    assert.ok(labels.includes("owned"));
    assert.ok(labels.includes("reference"));
    assert.ok(labels.includes("unknown"));
  });
}
