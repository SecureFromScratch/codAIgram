import { page } from '../../test-support.js';

export type PanelBoundsT = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

export async function diagramBounds(): Promise<PanelBoundsT> {
  return page.locator('.graph-pane').evaluate((element: HTMLElement) => {
    const bounds: DOMRect = element.getBoundingClientRect();
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}
