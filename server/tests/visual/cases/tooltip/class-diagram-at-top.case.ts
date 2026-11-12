import { test } from "node:test";
import { checkTooltipAtPanelEdge } from "../../support/tooltip-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "fits the method tooltip when ClassDiagram is scrolled to the top",
  prompt: {
    availability: "available",
    text: "When ClassDiagram is at the top of the graph panel and a method is hovered, the tooltip is not truncated by the screen or graph-panel limits.",
  },
};
export function registerClassDiagramAtTopTooltipCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await checkTooltipAtPanelEdge("top");
  });
}
