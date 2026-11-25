import type { Locator } from "playwright";
import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";

type PanelBoundsT = Awaited<ReturnType<Locator["boundingBox"]>>;

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: { when: string; text: string }[];
  };
} = {
  title: "toggles the bottom chat panel from the top bar",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/18 09:35", text: "add a button similar to this at top right corner of top bar.\nadd test - clicking this buttons toggles bottom panel that contains a chat window.", },
    ],
  },
};

export function registerChatPanelToggleCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const toggle: Locator = page.getByRole("button", { name: "Toggle chat panel", });
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(await page.getByRole("complementary", { name: "Chat panel" }).count(), 0);

    await toggle.click();
    const chat: Locator = page.getByRole("complementary", { name: "Chat panel", });
    await chat.waitFor();
    await page.getByRole("textbox", { name: "Message" }).waitFor();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    assert.ok(await chat.getByText("Ask a question about the current diagram.").isVisible());

    const panelBounds: Locator = chat;
    const bounds: PanelBoundsT = await panelBounds.boundingBox();
    assert.ok(bounds);
    const viewportHeight: number = await page.evaluate(() => window.innerHeight);
    assert.ok(Math.abs(bounds.y + bounds.height - viewportHeight) <= 1);

    await toggle.click();
    assert.equal(await page.getByRole("complementary", { name: "Chat panel" }).count(), 0);
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  });
}
