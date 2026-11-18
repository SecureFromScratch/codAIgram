import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: {
      when: string;
      text: string;
    }[];
  };
} = {
  title: "keeps the class heading area free of artifacts",
  prompt: {
    availability: "available",
    old: "Verify that only ClassDiagram appears within its header area.",
  
    history: [
      { when: "2026/11/15 09:35", text: "first test: the generated ClassDiagram box has only the header/name in the area for the name - no other artifiacts." },
    ],
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
        '[data-class-name="ClassDiagram"]',
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
