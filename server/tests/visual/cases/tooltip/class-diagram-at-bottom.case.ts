import { test } from "node:test";
import { checkTooltipAtPanelEdge } from "../../support/tooltip-support.js";
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
  title: "fits the method tooltip when ClassDiagram is scrolled to the bottom",
  prompt: {
    availability: "available",
    old: "When ClassDiagram is at the bottom of the graph panel and a method is hovered, the tooltip is not truncated by the screen or graph-panel limits.",
  
    history: [
      { when: "2026/11/15 09:35", text: "add 2 visual tests - when the ClassDiagram clasbox is at the top of the screen and when it's at the lowest position on the screen (using the scrollbar) and the mouse is hovered the tooltip appears and is not truncated by screen or graph-panel limits." },
    ],
  },
};
export function registerClassDiagramAtBottomTooltipCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await checkTooltipAtPanelEdge("bottom");
  });
}
