import { test } from 'node:test';
import { checkTooltipAtPanelEdge } from '../../support/tooltip-support.ts';

export const TEST_CASE_METADATA = {
  title: 'fits the method tooltip when ClassDiagram is scrolled to the bottom',
  prompt: { availability: 'available', text: 'When ClassDiagram is at the bottom of the graph panel and a method is hovered, the tooltip is not truncated by the screen or graph-panel limits.' }
};

export function registerClassDiagramAtBottomTooltipCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    await checkTooltipAtPanelEdge('bottom');
  });
}
