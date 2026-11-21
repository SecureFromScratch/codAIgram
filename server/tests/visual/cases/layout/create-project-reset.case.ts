import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "creating a project selects it and starts with an empty editor and graph",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "Selecting New project, entering a name, and clicking Create adds the project to the combobox, selects it, and resets the text editor and graph to empty." }],
  },
};

export function registerCreateProjectResetCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const selector: Locator = page.getByRole("combobox", { name: "Current project" });
    await selector.selectOption({ label: "New project" });
    const dialog: Locator = page.getByRole("dialog", { name: "New project" });
    await dialog.getByRole("textbox", { name: "Project name" }).fill("VisualCreatedProject");
    await dialog.getByRole("button", { name: "Create" }).click();
    await dialog.waitFor({ state: "detached" });

    await page.waitForFunction(() => {
      const projectSelect: HTMLSelectElement | null = document.querySelector(".project-selector");
      return projectSelect?.value === "VisualCreatedProject";
    });
    assert.equal(await selector.inputValue(), "VisualCreatedProject");
    assert.ok(await selector.locator("option").getByText("VisualCreatedProject", { exact: true }).count() === 1);

    const emptyCanvas: Locator = page.getByRole("img", { name: "Empty diagram canvas" });
    await emptyCanvas.waitFor();
    assert.equal((await page.locator(".cm-content").innerText()).trim(), "");
    assert.equal(await emptyCanvas.innerHTML(), "");
  });
}
