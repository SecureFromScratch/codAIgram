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
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const data: {
      headerValue: string;
      names: (string | null)[];
      headerBounds: DOMRect;
      textBounds: DOMRect;
    } = await page.evaluate(() => {
      const box: Element | null = document.querySelector(
        ".joint-type-standard-headeredrectangle",
      );
      const header: Element | null | undefined = box?.querySelector(
        'rect[joint-selector="header"]',
      );
      const text: SVGTextElement | null | undefined =
        box?.querySelector("text");
      if (
        header === null ||
        text === null ||
        header === undefined ||
        text === undefined
      )
        throw new Error("Expected class header.");
      const headerBounds: DOMRect = header.getBoundingClientRect();
      const textBounds: DOMRect = text.getBoundingClientRect();
      const names: (string | null)[] = [
        ...document.querySelectorAll("svg text"),
      ]
        .filter((element): boolean => {
          const bounds: DOMRect = element.getBoundingClientRect();
          return (
            bounds.top < headerBounds.bottom &&
            bounds.bottom > headerBounds.top &&
            bounds.left < headerBounds.right &&
            bounds.right > headerBounds.left
          );
        })
        .map((element): string | null => element.textContent);
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
