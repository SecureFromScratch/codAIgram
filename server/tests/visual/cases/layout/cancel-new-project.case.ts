import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "canceling new project entry preserves the editor and graph",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "When New project is selected in the project combobox, show a prompt for a project name. Canceling it closes the prompt and leaves the editor and graph unchanged." }],
  },
};

export function registerCancelNewProjectCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const selector: Locator = page.getByRole("combobox", { name: "Current project" });
    const projectBefore: string = await selector.inputValue();
    const editorBefore: string = await page.locator(".cm-content").innerText();
    const graphBefore: string = await page.locator(".canvas").innerHTML();
    await selector.selectOption({ label: "New project" });
    const dialog: Locator = page.getByRole("dialog", { name: "New project" });
    await dialog.waitFor();
    assert.ok(await dialog.getByRole("textbox", { name: "Project name" }).isVisible());
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await dialog.waitFor({ state: "detached" });

    assert.equal(await selector.inputValue(), projectBefore);
    assert.equal(await page.locator(".cm-content").innerText(), editorBefore);
    assert.equal(await page.locator(".canvas").innerHTML(), graphBefore);
  });
}
