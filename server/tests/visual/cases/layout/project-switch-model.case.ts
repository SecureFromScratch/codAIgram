import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import { page } from "../../test-support.js";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";

type ProjectModelProbeT = {
  hookStatus: "ready" | "unavailable";
  selectedProjectClass: "present" | "absent";
  previousProjectClass: "present" | "absent";
};
type ModelLookupT = { isOk: () => boolean };
type ModelTestHookT = { tryGetModel: (name: string) => ModelLookupT };
type WindowWithModelHookT = Window & { __app?: ModelTestHookT };

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "switching projects updates the graph and current class model",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "Add a visual test that changing the project combobox updates the graph and Model.current to the selected project's classes." }],
  },
};

export function registerProjectSwitchModelCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const selector: Locator = page.getByRole("combobox", { name: "Current project" });
    await page.locator('[data-class-name="ClassDiagram"]').waitFor();
    const initialModel: ProjectModelProbeT = await readProjectModel();
    assert.equal(initialModel.selectedProjectClass, "absent");
    assert.equal(initialModel.previousProjectClass, "present");

    await selector.selectOption("another");
    await page.locator('[data-class-name="AnotherProjectClass"]').waitFor();
    await page.locator('[data-class-name="ClassDiagram"]').waitFor({ state: "detached" });

    const selectedModel: ProjectModelProbeT = await readProjectModel();
    assert.equal(await selector.inputValue(), "another");
    assert.equal(selectedModel.hookStatus, "ready");
    assert.equal(selectedModel.selectedProjectClass, "present");
    assert.equal(selectedModel.previousProjectClass, "absent");
  });
}

async function readProjectModel(): Promise<ProjectModelProbeT> {
  return page.evaluate(() => {
    const app: ModelTestHookT | undefined = (window as WindowWithModelHookT).__app;
    if (!app) return {
      hookStatus: "unavailable",
      selectedProjectClass: "absent",
      previousProjectClass: "absent",
    };
    return {
      hookStatus: "ready",
      selectedProjectClass: app.tryGetModel("AnotherProjectClass").isOk() ? "present" : "absent",
      previousProjectClass: app.tryGetModel("ClassDiagram").isOk() ? "present" : "absent",
    };
  });
}
