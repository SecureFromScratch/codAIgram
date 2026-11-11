import { page } from '../test-support.ts';

type BoundsT = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};

export type DiagramInspectionT = {
  readonly header: BoundsT;
  readonly box: BoundsT;
  readonly headerText: BoundsT;
  readonly bodyText: BoundsT;
  readonly headerValue: string | null;
  readonly bodyValue: string;
  readonly inHeader: readonly (string | null)[];
  readonly target: BoundsT;
};

export async function inspectDiagram(): Promise<DiagramInspectionT> {
  return page.evaluate((): DiagramInspectionT => {
    const source = document.querySelector('.joint-type-standard-headeredrectangle');
    const target = document.querySelector('.joint-type-standard-rectangle');
    if (source === null || target === null) throw new Error('Expected both class boxes.');
    const rectangles = source.querySelectorAll('rect');
    const text = source.querySelectorAll('text');
    if (rectangles.length !== 2 || text.length !== 2) throw new Error('Expected a class body, header and two text areas.');
    const bodyRectangle = rectangles.item(0);
    const headerRectangle = rectangles.item(1);
    const headerText = text.item(0);
    const bodyText = text.item(1);
    if (bodyRectangle === null || headerRectangle === null || headerText === null || bodyText === null) throw new Error('Expected a complete class box.');
    const bounds = (element: Element): BoundsT => {
      const rectangle = element.getBoundingClientRect();
      return { left: rectangle.left, top: rectangle.top, right: rectangle.right, bottom: rectangle.bottom, width: rectangle.width, height: rectangle.height };
    };
    const header = bounds(headerRectangle);
    const intersects = (first: BoundsT, second: BoundsT): boolean => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    const inHeader = [...document.querySelectorAll('svg text')].filter((element: Element): boolean => intersects(bounds(element), header)).map((element: Element): string | null => element.textContent);
    const bodyValue = [...bodyText.querySelectorAll(':scope > tspan')].map((row: Element): string => [...row.childNodes].map((node: ChildNode): string => node.nodeName.toLowerCase() === 'tspan' ? [...node.childNodes].filter((child: ChildNode): boolean => child.nodeType === Node.TEXT_NODE).map((child: ChildNode): string | null => child.textContent).join('') : node.textContent ?? '').join('')).join('');
    const targetRectangle = target.querySelector('rect');
    if (targetRectangle === null) throw new Error('Expected a target class box.');
    return { header, box: bounds(bodyRectangle), headerText: bounds(headerText), bodyText: bounds(bodyText), headerValue: headerText.textContent, bodyValue, inHeader, target: bounds(targetRectangle) };
  });
}
