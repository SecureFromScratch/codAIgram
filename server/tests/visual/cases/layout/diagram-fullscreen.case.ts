import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";

type PanelBoundsT = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

async function diagramBounds(): Promise<PanelBoundsT> {
  return page.locator(".graph-pane").evaluate((element: HTMLElement) => {
    const bounds: DOMRect = element.getBoundingClientRect();
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}

export const FULLSCREEN_TEST_METADATA: {
  expandTitle: string;
  restoreTitle: string;
  prompt: {
    availability: string;
    history: { when: string; text: string }[];
  };
} = {
  expandTitle: "expands the diagram panel to fill the screen",
  restoreTitle: "restores the diagram panel to its original size",
  prompt: {
    availability: "available",
    history: [
      {
        when: "2026/11/18 09:35",
        text: "on the diagram panel - add a [ ] button at the top right.\nthen add tests: clicking toggle the diagram panel between current view and full screen view.",
      },
    ],
  },
};

export function registerDiagramFullscreenCases(): void {
  test(FULLSCREEN_TEST_METADATA.expandTitle, async () => {
    const toggle: import("playwright").Locator = page.getByRole("button", {
      name: "Expand diagram to full screen",
    });
    await toggle.waitFor();
    await toggle.click();
    await page
      .getByRole("button", { name: "Exit full screen diagram" })
      .waitFor();

    const bounds: PanelBoundsT = await diagramBounds();
    assert.ok(Math.abs(bounds.left) <= 1);
    assert.ok(Math.abs(bounds.top) <= 1);
    assert.ok(Math.abs(bounds.width - bounds.viewportWidth) <= 1);
    assert.ok(Math.abs(bounds.height - bounds.viewportHeight) <= 1);
  });

  test(FULLSCREEN_TEST_METADATA.restoreTitle, async () => {
    await page
      .getByRole("button", { name: "Expand diagram to full screen" })
      .click();
    await page
      .getByRole("button", { name: "Exit full screen diagram" })
      .click();
    await page
      .getByRole("button", { name: "Expand diagram to full screen" })
      .waitFor();

    const bounds: PanelBoundsT = await diagramBounds();
    assert.ok(bounds.left > 0);
    assert.ok(bounds.top > 0);
    assert.ok(bounds.width < bounds.viewportWidth);
    assert.ok(bounds.height < bounds.viewportHeight);
    assert.equal(await page.locator(".text-pane").isVisible(), true);
  });
}
