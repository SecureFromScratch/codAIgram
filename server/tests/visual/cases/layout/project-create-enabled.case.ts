import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "enables Create after a project name is entered",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "Add a visual test verifying that entering a non-empty project name enables the Create button." }],
  },
};

export function registerProjectCreateEnabledCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const selector: Locator = page.getByRole("combobox", { name: "Current project" });
    await selector.selectOption({ label: "New project" });
    const dialog: Locator = page.getByRole("dialog", { name: "New project" });
    const projectName: Locator = dialog.getByRole("textbox", { name: "Project name" });
    const createButton: Locator = dialog.getByRole("button", { name: "Create" });
    await projectName.fill("NewModel");
    assert.equal(await createButton.isEnabled(), true);
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
}
