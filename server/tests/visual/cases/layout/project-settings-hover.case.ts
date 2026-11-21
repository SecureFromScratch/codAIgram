import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

type LocatorBoundsT = Awaited<ReturnType<Locator["boundingBox"]>>;

const LONG_PROJECT_NAME: string = "LongProjectNameThatWouldOtherwiseOverlapTheProjectSettingsButton_0123456789";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "shows project settings and full-name tooltip for ellipsized project names",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/19 09:35", text: "Create a project with a very long name. The combobox cuts the displayed name short with an ellipsis, and hovering over the name shows a tooltip with the complete name." },
      { when: "2026/11/19 09:35", text: "The project settings gear appears within the combobox, to the left of its dropdown arrow, and uses the ⚙️ emoji." },
    ],
  },
};

export function registerProjectSettingsHoverCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const selector: Locator = page.getByRole("combobox", { name: "Current project" });
    const settings: Locator = page.getByRole("button", { name: "Project settings" });
    await selector.waitFor();
    assert.equal(await settings.isVisible(), false);
    await selector.hover();
    assert.equal(await settings.isVisible(), true);

    await selector.selectOption({ label: "New project" });
    const projectDialog: Locator = page.getByRole("dialog", { name: "New project" });
    await projectDialog.getByRole("textbox", { name: "Project name" }).fill(LONG_PROJECT_NAME);
    await projectDialog.getByRole("button", { name: "Create" }).click();
    await projectDialog.waitFor({ state: "detached" });
    await page.getByRole("option", { name: LONG_PROJECT_NAME, exact: true }).waitFor({ state: "attached" });
    await page.mouse.move(1200, 900);
    assert.equal(await settings.isVisible(), false);
    await selector.hover();
    assert.equal(await settings.isVisible(), true);
    assert.equal(await selector.inputValue(), LONG_PROJECT_NAME);
    assert.ok(LONG_PROJECT_NAME.length > 40);
    const tooltip: Locator = page.getByRole("tooltip");
    await tooltip.waitFor({ state: "visible" });
    assert.equal(await tooltip.textContent(), LONG_PROJECT_NAME);

    const textOverflow: string = await selector.evaluate((element: HTMLSelectElement) => getComputedStyle(element).textOverflow);
    const whiteSpace: string = await selector.evaluate((element: HTMLSelectElement) => getComputedStyle(element).whiteSpace);
    assert.equal(textOverflow, "ellipsis");
    assert.equal(whiteSpace, "nowrap");

    const selectorBounds: LocatorBoundsT = await selector.boundingBox();
    const settingsBounds: LocatorBoundsT = await settings.boundingBox();
    assert.ok(selectorBounds);
    assert.ok(settingsBounds);
    assert.ok(settingsBounds.x > selectorBounds.x);
    assert.ok(settingsBounds.x + settingsBounds.width < selectorBounds.x + selectorBounds.width);
    assert.ok(selectorBounds.x + selectorBounds.width - (settingsBounds.x + settingsBounds.width) >= 15);
    assert.ok(selectorBounds.x + selectorBounds.width - (settingsBounds.x + settingsBounds.width) <= 35);
    assert.equal(await settings.textContent(), "⚙️");
  });
}
