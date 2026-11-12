import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "keeps the class heading area free of artifacts",
  prompt: {
    availability: "available",
    text: "Verify that only ClassDiagram appears within its header area.",
  },
};
export function registerHeadingAreaCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const data: {
      headerValue: string;
      names: Node["textContent"][];
      headerBounds: DOMRect;
      textBounds: DOMRect;
    } = await page.evaluate(() => {
      const box: ReturnType<Document["querySelector"]> = document.querySelector(
        ".joint-type-standard-headeredrectangle",
      );
      if (!box) window.logAndThrow(new Error("Expected class box."));
      const header: ReturnType<Element["querySelector"]> = box.querySelector(
        'rect[joint-selector="header"]',
      );
      const text: ReturnType<Element["querySelector"]> = box.querySelector("text");
      if (!header || !text)
        window.logAndThrow(new Error("Expected class header."));
      const headerBounds: DOMRect = header.getBoundingClientRect();
      const textBounds: DOMRect = text.getBoundingClientRect();
      const names: Node["textContent"][] = [
        ...document.querySelectorAll("svg text"),
      ]
        .filter((element) => {
          const bounds: DOMRect = element.getBoundingClientRect();
          return (
            bounds.top < headerBounds.bottom &&
            bounds.bottom > headerBounds.top &&
            bounds.left < headerBounds.right &&
            bounds.right > headerBounds.left
          );
        })
        .map((element) => element.textContent);
      return {
        headerValue: text.textContent,
        names,
        headerBounds,
        textBounds,
      };
    });
    assert.equal(data.headerValue, "ClassDiagram");
    assert.deepEqual(data.names, ["ClassDiagram"]);
    assert.ok(
      data.textBounds.top >= data.headerBounds.top &&
        data.textBounds.bottom <= data.headerBounds.bottom,
    );
  });
}
