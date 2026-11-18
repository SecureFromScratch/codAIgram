import assert from "node:assert/strict";
import { test } from "node:test";
import type { Locator } from "playwright";
import { page } from "../../test-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: { when: string; text: string }[];
  };
} = {
  title: "resizes the workspace panels and hides narrow subtitles without wrapping",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/18 09:35", text: "add test: hovering over the separator between the text editor panel and the diagram panel transforms the mouse cursor to \"move left-right\" cursor style.dragging left right changes proportion between editor/diagram. proportion cannot be changed to worse than 20/80 or 80/20." },
      { when: "2026/11/18 09:35", text: "add test - when dragging and changing panel proportions- subheading near panel names don't wrap or move below - they disappear. when they reappear it's with a fade" },
      { when: "2026/11/18 09:35", text: "add test: changing proportions between panels and then reloading page keeps the proportions. [when making the text green implement storage in local storage]" },
    ],
  },
};

type PanelSizesT = {
  editorWidth: number;
  diagramWidth: number;
  editorPercent: number;
};
type PanelBoundsT = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;
type SubtitleWaitT = { subtitleSelector: string; expectedOpacity: string };
type OptionalPanelBoundsT = Awaited<ReturnType<Locator["boundingBox"]>>;

async function requiredBounds(locator: Locator): Promise<PanelBoundsT> {
  const bounds: OptionalPanelBoundsT = await locator.boundingBox();
  if (!bounds) window.logAndThrow(new Error("Expected the panel element to have a visible bounding box."));
  return bounds;
}

async function panelSizes(): Promise<PanelSizesT> {
  return page.evaluate(() => {
    // UNTRUST-ALLOW-NULLISH: The test page mounts these two workspace panels before measuring them; querySelector can still return null if the UI failed to render, which should fail the test clearly.
    const editor: HTMLElement | null = document.querySelector(".text-pane");
    // UNTRUST-ALLOW-NULLISH: The diagram panel is created by the same workspace render; keep this DOM boundary explicit so a failed render produces a test diagnostic instead of an unsafe access.
    const diagram: HTMLElement | null = document.querySelector(".graph-pane");
    if (!editor || !diagram) window.logAndThrow(new Error("Expected both workspace panels."));
    const editorWidth: number = editor.getBoundingClientRect().width;
    const diagramWidth: number = diagram.getBoundingClientRect().width;
    return {
      editorWidth,
      diagramWidth,
      editorPercent: editorWidth / (editorWidth + diagramWidth) * 100,
    };
  });
}

async function dragPanelsToEditorPercent(editorPercent: number): Promise<void> {
  const splitter: Locator = page.getByRole("separator", { name: "Resize text editor and diagram panels" });
  const splitterBounds: PanelBoundsT = await requiredBounds(splitter);
  const workspaceBounds: PanelBoundsT = await requiredBounds(page.locator(".workspace-resizable"));
  const availableWidth: number = workspaceBounds.width - 44 - 12;
  const targetX: number = workspaceBounds.x + 22 + availableWidth * editorPercent / 100 + 6;
  const centerY: number = splitterBounds.y + splitterBounds.height / 2;
  await page.mouse.move(splitterBounds.x + splitterBounds.width / 2, centerY);
  await page.mouse.down();
  await page.mouse.move(targetX, centerY);
  await page.mouse.up();
}

async function waitForSubtitleOpacity(selector: string, opacity: "0" | "1"): Promise<void> {
  await page.waitForFunction(({ subtitleSelector, expectedOpacity }: SubtitleWaitT) => {
    // UNTRUST-ALLOW-NULLISH: The subtitle can be absent only if the panel failed to mount; return false while waiting so Playwright reports a useful timeout.
    const subtitle: Element | null = document.querySelector(subtitleSelector);
    if (!subtitle) return false;
    return getComputedStyle(subtitle).opacity === expectedOpacity;
  }, { subtitleSelector: selector, expectedOpacity: opacity });
}

async function waitForSubtitleFade(selector: string): Promise<void> {
  await page.waitForFunction((subtitleSelector: string) => {
    // UNTRUST-ALLOW-NULLISH: During a resize the panel or subtitle may not yet have mounted; wait for the rendered element before sampling its transition opacity, and report a timeout if it never appears.
    const subtitle: Element | null = document.querySelector(subtitleSelector);
    if (!subtitle) return false;
    const opacity: number = Number(getComputedStyle(subtitle).opacity);
    return opacity > 0 && opacity < 1;
  }, selector);
}

export function registerPanelResizingCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const splitter: Locator = page.getByRole("separator", { name: "Resize text editor and diagram panels" });
    const splitterBounds: PanelBoundsT = await requiredBounds(splitter);
    const workspaceBounds: PanelBoundsT = await requiredBounds(page.locator(".workspace-resizable"));
    const dividerY: number = splitterBounds.y + splitterBounds.height / 2;
    await page.mouse.move(splitterBounds.x + splitterBounds.width / 2, dividerY);
    assert.equal(await splitter.evaluate((element: HTMLElement) => getComputedStyle(element).cursor), "ew-resize");

    const before: PanelSizesT = await panelSizes();
    await page.mouse.down();
    await page.mouse.move(workspaceBounds.x + workspaceBounds.width * 0.3, dividerY);
    await page.mouse.up();
    const after: PanelSizesT = await panelSizes();
    assert.ok(after.editorPercent < before.editorPercent);
    assert.ok(after.diagramWidth > before.diagramWidth);

    const editorSubtitle: Locator = page.locator(".text-pane .pane-title-row .hint");
    const diagramSubtitle: Locator = page.locator(".graph-pane .pane-title-row .hint");
    const editorTitleRow: Locator = page.locator(".text-pane .pane-title-row");
    const diagramTitleRow: Locator = page.locator(".graph-pane .pane-title-row");
    const initialEditorHeight: number = (await requiredBounds(editorTitleRow)).height;
    const initialDiagramHeight: number = (await requiredBounds(diagramTitleRow)).height;

    await dragPanelsToEditorPercent(20);
    await waitForSubtitleOpacity(".text-pane .pane-title-row .hint", "0");
    assert.equal(await diagramSubtitle.evaluate((element: HTMLElement) => getComputedStyle(element).opacity), "1");
    assert.equal((await requiredBounds(editorTitleRow)).height, initialEditorHeight);
    assert.equal((await requiredBounds(diagramTitleRow)).height, initialDiagramHeight);
    assert.equal(await editorSubtitle.evaluate((element: HTMLElement) => element.getBoundingClientRect().width), 0);

    await dragPanelsToEditorPercent(42);
    await waitForSubtitleFade(".text-pane .pane-title-row .hint");
    await waitForSubtitleOpacity(".text-pane .pane-title-row .hint", "1");

    await dragPanelsToEditorPercent(80);
    await waitForSubtitleOpacity(".graph-pane .pane-title-row .hint", "0");
    assert.equal(await editorSubtitle.evaluate((element: HTMLElement) => getComputedStyle(element).opacity), "1");
    assert.equal((await requiredBounds(editorTitleRow)).height, initialEditorHeight);
    assert.equal((await requiredBounds(diagramTitleRow)).height, initialDiagramHeight);

    await dragPanelsToEditorPercent(42);
    await waitForSubtitleFade(".graph-pane .pane-title-row .hint");
    await waitForSubtitleOpacity(".graph-pane .pane-title-row .hint", "1");

    await dragPanelsToEditorPercent(20);
    assert.ok(Math.abs((await panelSizes()).editorPercent - 20) < 0.5);
    await dragPanelsToEditorPercent(80);
    assert.ok(Math.abs((await panelSizes()).editorPercent - 80) < 0.5);

    await dragPanelsToEditorPercent(63);
    const beforeReload: PanelSizesT = await panelSizes();
    await page.reload();
    await page.waitForFunction(() => Boolean(document.querySelector(".workspace-resizable")));
    const afterReload: PanelSizesT = await panelSizes();
    assert.ok(Math.abs(afterReload.editorPercent - beforeReload.editorPercent) < 0.5);
  });
}
