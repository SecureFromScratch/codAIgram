import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "renders ownership with matching headers and a filled diamond",
  prompt: {
    availability: "available",
    text: "Render OWNS with a filled UML source diamond and member/multiplicity labels.",
  },
};
export function registerOwnershipConnectorCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const data: {
      headerHeight: number;
      partialHeight: number;
      headerFill: string | null;
      partialFill: string | null;
      marker: string;
      labels: (string | null)[];
    } = await page.evaluate(() => {
      const header: Element | null = document.querySelector(
        '.joint-type-standard-headeredrectangle rect[joint-selector="header"]',
      );
      const partial: Element | null = document.querySelector(
        ".joint-type-standard-rectangle rect",
      );
      const link: Element | null = document.querySelector(
        '.joint-link path[joint-selector="line"]',
      );
      if (header === null || partial === null || link === null)
        throw new Error("Expected class boxes and ownership link.");
      const markerId: string | undefined = link
        .getAttribute("marker-start")
        ?.match(/#([^\)]+)/)?.[1];
      const marker: HTMLElement | null =
        markerId === undefined ? null : document.getElementById(markerId);
      return {
        headerHeight: header.getBoundingClientRect().height,
        partialHeight: partial.getBoundingClientRect().height,
        headerFill: header.getAttribute("fill"),
        partialFill: partial.getAttribute("fill"),
        marker: marker?.innerHTML ?? "",
        labels: [...document.querySelectorAll(".joint-link text")].map(
          (text): string | null => text.textContent,
        ),
      };
    });
    assert.equal(data.headerHeight, 30);
    assert.equal(data.partialHeight, data.headerHeight);
    assert.equal(data.partialFill, data.headerFill);
    assert.match(data.marker, /M 0 0 L 10 -6 L 20 0 L 10 6 Z/);
    assert.match(data.marker, /fill="#233f73"/);
    assert.deepEqual(data.labels, ["classes", "*"]);
  });
}
