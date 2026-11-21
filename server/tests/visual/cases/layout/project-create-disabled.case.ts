import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "disables Create in the new project dialog until a name is entered",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "Add a visual test verifying that the new project dialog's Create button is disabled while its project name field is empty." }],
  },
};

export function registerProjectCreateDisabledCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const selector: Locator = page.getByRole("combobox", { name: "Current project" });
    await selector.selectOption({ label: "New project" });
    const dialog: Locator = page.getByRole("dialog", { name: "New project" });
    const projectName: Locator = dialog.getByRole("textbox", { name: "Project name" });
    const createButton: Locator = dialog.getByRole("button", { name: "Create" });
    await projectName.waitFor();
    assert.equal(await projectName.inputValue(), "");
    assert.equal(await createButton.isDisabled(), true);

    await projectName.fill("NewModel");
    assert.equal(await createButton.isEnabled(), true);
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
}
