import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "renders a filled circular eye badge at the top left of editor-visible classes",
  prompt: {
    availability: "available",
    text: "Classes currently displayed in the text area have an open-eye emoji badge at the top left, within a small filled circle.",
  },
};
export function registerEyeBadgeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    await editor.fill(`${text}\n\nClass\n  isPartial: bool`);
    const badges: import("playwright").Locator =
      page.locator("[data-eye-badge]");
    await page.waitForFunction(
      () => document.querySelectorAll("[data-eye-badge]").length === 2,
    );
    {
      const __badgeValues: readonly import("playwright").Locator[] =
        await badges.all();
      for (
        let __badgeIndex: number = 0;
        __badgeIndex < __badgeValues.length;
        __badgeIndex += 1
      ) {
        const badge: import("playwright").Locator =
          __badgeValues[__badgeIndex]!;
        const info: {
          readonly text: Node["textContent"];
          readonly circle: string;
          readonly width: number;
          readonly height: number;
          readonly left: number;
          readonly top: number;
          readonly boxLeft: number | undefined;
          readonly boxTop: number | undefined;
        } = await badge.evaluate(
          (
            element: Element,
          ) => {
            const circle: ReturnType<Element["querySelector"]> =
              element.querySelector("circle");
            const box: ReturnType<Element["querySelector"]> | undefined = element
              .closest(".joint-element")
              ?.querySelector("rect");
            const bounds: DOMRect = element.getBoundingClientRect();
            const boxBounds: DOMRect | undefined = box?.getBoundingClientRect();
            return {
              text: element.textContent,
              circle: circle ? getComputedStyle(circle).fill : "",
              width: bounds.width,
              height: bounds.height,
              left: bounds.left,
              top: bounds.top,
              boxLeft: boxBounds?.left,
              boxTop: boxBounds?.top,
            };
          },
        );
        assert.ok(info.text?.includes("\u{1F441}") === true);
        assert.ok(info.circle && info.circle !== "none");
        assert.ok(
          Math.abs(info.width - info.height) <= 2 && info.width <= 32,
          "badge is a small circle",
        );
        assert.ok(
          typeof info.boxLeft === "number" && typeof info.boxTop === "number",
          "badge belongs to a class box",
        );
        assert.ok(
          Math.abs(info.left - info.boxLeft) <= info.width &&
            Math.abs(info.top - info.boxTop) <= info.height,
          "badge is at the class box top left",
        );
      }
    }
  });
}
