import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title: "renders ownership with matching headers and a filled diamond",
  prompt: {
    availability: "available",
    old: "Render OWNS with a filled UML source diamond and member/multiplicity labels.",
  
    history: [
      { when: "2026/11/15 09:35", text: "graph visual changes:\n1) classbox top bar (with the name) has to much bottom padding - should be a tighter bar vertically.\n2) the partial class \"Class\" classbox only contains its name - which is the right way, but the bg color/styl should be as for the name bar in a regular (with methods) classbox - it's a classbox with no methods textbox area.\n3) for each method line in the classbox method area - only put the method name. tooltip (when hovering) will contain show full method signature, but with param names and not types. instead types will be listed below, i.e.:\n  addClass(name, publicMethods)\n  -name: string\n  -publicMethods: string[]\n4) the OWNS line should not be listed in thevisual\n5) the name of the member variable for the OWNS classes: Class[] should be on the connector to Class\n6) since this is a OWNS relatiobnship the connector needs to start with a filled diamond (uml standard notation for ownership)" },
    ],
  },
};
export function registerOwnershipConnectorCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const data: {
      headerHeight: number;
      partialHeight: number;
      headerFill: ReturnType<Element["getAttribute"]>;
      partialFill: ReturnType<Element["getAttribute"]>;
      marker: string;
      labels: Node["textContent"][];
    } = await page.evaluate(() => {
      const header: ReturnType<Document["querySelector"]> = document.querySelector(
        '[data-class-name="ClassDiagram"] rect[joint-selector="header"]',
      );
      const partial: ReturnType<Document["querySelector"]> = document.querySelector(
        '[data-class-name="Class"] rect',
      );
      const link: ReturnType<Document["querySelector"]> = document.querySelector(
        '.joint-link path[joint-selector="line"]',
      );
      if (!header || !partial || !link)
        window.logAndThrow(new Error("Expected class boxes and ownership link."));
      const markerId: string | undefined = link
        .getAttribute("marker-start")
        ?.match(/#([^\)]+)/)?.[1];
      const markerMarkup: string = markerId ? document.getElementById(markerId)?.innerHTML ?? "" : "";
      return {
        headerHeight: header.getBoundingClientRect().height,
        partialHeight: partial.getBoundingClientRect().height,
        headerFill: header.getAttribute("fill"),
        partialFill: partial.getAttribute("fill"),
        marker: markerMarkup,
        labels: [...document.querySelectorAll(".joint-link text")].map(
          (text) => text.textContent,
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
