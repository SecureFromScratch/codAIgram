import assert from 'node:assert/strict';
import { page } from '../test-support.ts';

export type TooltipPanelEdgeT = 'top' | 'bottom';

export async function checkTooltipAtPanelEdge(edge: TooltipPanelEdgeT): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 440 });
  try {
    const canvas = page.locator('.canvas');
    await canvas.evaluate((element: Element, edgeName: TooltipPanelEdgeT): void => {
      const box = element.querySelector('.joint-type-standard-headeredrectangle rect');
      const viewport = element.getBoundingClientRect();
      if (box === null) throw new Error('Expected the ClassDiagram box.');
      const rectangle = box.getBoundingClientRect();
      element.scrollTop += edgeName === 'top' ? rectangle.top - viewport.top - 2 : rectangle.bottom - viewport.bottom + 2;
    }, edge);
    const placement = await canvas.evaluate((element: Element): { readonly topGap: number; readonly bottomGap: number; readonly scrollTop: number } => {
      const box = element.querySelector('.joint-type-standard-headeredrectangle rect');
      if (box === null) throw new Error('Expected the ClassDiagram box.');
      const rectangle = box.getBoundingClientRect();
      const panel = element.getBoundingClientRect();
      return { topGap: rectangle.top - panel.top, bottomGap: panel.bottom - rectangle.bottom, scrollTop: element.scrollTop };
    });
    assert.ok(placement.scrollTop > 0, 'the graph scrollbar was used');
    assert.ok(Math.abs(edge === 'top' ? placement.topGap : placement.bottomGap) <= 4, `class box is at the ${edge} of the graph panel`);
    await page.locator('.joint-type-standard-headeredrectangle [data-method-index="0"]').hover();
    const tooltip = page.getByRole('tooltip');
    await tooltip.waitFor();
    const bounds = await tooltip.evaluate((element: HTMLElement): { readonly tip: DOMRect; readonly panel: DOMRect; readonly width: number; readonly height: number; readonly scrollHeight: number; readonly clientHeight: number; readonly text: string } => {
      const panel = element.closest('.graph-pane');
      if (panel === null) throw new Error('Expected the graph pane.');
      return { tip: element.getBoundingClientRect(), panel: panel.getBoundingClientRect(), width: window.innerWidth, height: window.innerHeight, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, text: element.innerText };
    });
    assert.ok(bounds.text.includes('publicMethods') && bounds.text.includes('string[]'), 'full signature and type details are visible');
    assert.ok(bounds.tip.top >= bounds.panel.top && bounds.tip.bottom <= bounds.panel.bottom, 'tooltip fits vertically in the graph panel');
    assert.ok(bounds.tip.left >= bounds.panel.left && bounds.tip.right <= bounds.panel.right, 'tooltip fits horizontally in the graph panel');
    assert.ok(bounds.tip.top >= 0 && bounds.tip.bottom <= bounds.height && bounds.tip.left >= 0 && bounds.tip.right <= bounds.width, 'tooltip fits inside the screen');
    assert.ok(bounds.scrollHeight <= bounds.clientHeight + 1, 'tooltip content is not clipped');
  } finally {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.locator('.canvas').evaluate((element: Element): void => { element.scrollTop = 0; });
    await page.mouse.move(2, 2);
  }
}
