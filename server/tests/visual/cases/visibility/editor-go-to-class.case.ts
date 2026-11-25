import type { Locator } from "playwright";
import assert from "node:assert/strict";
import { test } from "node:test";
import { page, setVisualClasses } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: { when: string; text: string; }[];
  };
} = {
  title: "Ctrl+G centers the class under the editor cursor in the graph",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/18 09:35", text: "add a test: standing on a class in the text editor and pressing ctrl+g scrolls the graph so that class is visibl, in the most centered position possible (thagt means centerred unless that cannot be acjeieved due to scroll edge)", },
    ],
  },
};

type CenteringStateT = "centered" | "at-scroll-edge";
type VisibilityStateT = "fully-visible" | "clipped";

type GraphPositionT = {
  scrollLeft: number;
  scrollTop: number;
  expectedLeft: number;
  expectedTop: number;
  maxLeft: number;
  maxTop: number;
  centeredHorizontally: CenteringStateT;
  centeredVertically: CenteringStateT;
  fullyVisible: VisibilityStateT;
};

async function graphPosition(className: string): Promise<GraphPositionT> {
  return page.evaluate((targetName: string) => {
    const canvas: HTMLElement = document.querySelector<HTMLElement>(".canvas") ?? window.logAndThrow(new Error("Expected the diagram canvas."));
    const target: Element = Array.from(
      document.querySelectorAll(".canvas [data-class-name]"),
    ).find((element: Element) => element.getAttribute("data-class-name") === targetName) ?? window.logAndThrow(new Error("Expected the target class in the graph."));
    const canvasBounds: DOMRect = canvas.getBoundingClientRect();
    const targetBounds: DOMRect = target.getBoundingClientRect();
    const maxLeft: number = Math.max(0, canvas.scrollWidth - canvas.clientWidth);
    const maxTop: number = Math.max(0, canvas.scrollHeight - canvas.clientHeight);
    const contentCenterX: number = targetBounds.left - canvasBounds.left + canvas.scrollLeft + targetBounds.width / 2;
    const contentCenterY: number = targetBounds.top - canvasBounds.top + canvas.scrollTop + targetBounds.height / 2;
    const expectedLeft: number = Math.max(0, Math.min(contentCenterX - canvas.clientWidth / 2, maxLeft));
    const expectedTop: number = Math.max(0, Math.min(contentCenterY - canvas.clientHeight / 2, maxTop));
    return {
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
      expectedLeft,
      expectedTop,
      maxLeft,
      maxTop,
      centeredHorizontally: expectedLeft > 0 && expectedLeft < maxLeft ? "centered" : "at-scroll-edge",
      centeredVertically: expectedTop > 0 && expectedTop < maxTop ? "centered" : "at-scroll-edge",
      fullyVisible: targetBounds.left >= canvasBounds.left && targetBounds.right <= canvasBounds.right && targetBounds.top >= canvasBounds.top && targetBounds.bottom <= canvasBounds.bottom ? "fully-visible" : "clipped",
    };
  }, className);
}

export function registerEditorGoToClassCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const additionalClasses: readonly {
      name: string;
      methods: { name: string; overloads: { arg: string; t: string }[][] }[];
      relations: [];
    }[] = Array.from({ length: 14 }, (_unused: unknown, index: number) => ({
      name: `FarClass${String(index + 1).padStart(2, "0")}`,
      methods: [
        { 
          name: "value", 
          overloads: [[{ arg: "+RO", t: "string" }]] 
        },
      ],
      relations: [],
    }));
    await setVisualClasses([
      { name: "ClassDiagram", methods: [], relations: [] },
      ...additionalClasses,
    ]);

    const { editor }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor("FarClass13");
    const classHeading: Locator = editor
      .locator(".cm-line")
      .filter({ hasText: /^FarClass13$/ });
    await classHeading.click();
    await editor.press("Control+g");

    const farClassPosition: GraphPositionT = await graphPosition("FarClass13");
    assert.equal(farClassPosition.centeredHorizontally, "centered");
    assert.equal(farClassPosition.centeredVertically, "centered");
    assert.equal(farClassPosition.fullyVisible, "fully-visible", JSON.stringify(farClassPosition));
    assert.ok(Math.abs(farClassPosition.scrollLeft - farClassPosition.expectedLeft) <= 1);
    assert.ok(Math.abs(farClassPosition.scrollTop - farClassPosition.expectedTop) <= 1);

    await page.evaluate(() => {
      const app: { selectClass: (name: string) => void } | undefined =
        (window as Window & { __app?: { selectClass: (name: string) => void } }).__app;
      if (!app) window.logAndThrow(new Error("Application command hook is unavailable."));
      app.selectClass("ClassDiagram");
    });
    await page.waitForFunction(() =>
      document.querySelector(".cm-content .cm-line")?.textContent === "ClassDiagram",
    );
    const firstHeading: Locator = editor.locator(".cm-line").first();
    await firstHeading.click();
    await editor.press("Control+g");
    const firstClassPosition: GraphPositionT = await graphPosition("ClassDiagram");
    assert.equal(firstClassPosition.centeredHorizontally, "at-scroll-edge");
    assert.equal(firstClassPosition.centeredVertically, "at-scroll-edge");
    assert.equal(firstClassPosition.scrollLeft, 0);
    assert.equal(firstClassPosition.scrollTop, 0);
  });
}
