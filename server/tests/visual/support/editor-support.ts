import type { Locator } from "playwright";
import { page } from "../test-support.js";
export type EditorStateT = {
  readonly editor: import("playwright").Locator;
  readonly text: string;
};
export async function resetOwnershipEditor(name: string = "ClassDiagram"): Promise<EditorStateT> {
  await page.reload();
  await page.waitForFunction(() => Boolean((window as Window & { __app?: unknown }).__app));
  await page.evaluate((className: string) => {
    const app: { selectClass: (name: string) => void } | undefined = (window as Window & { __app?: { selectClass: (name: string) => void } }).__app;
    if (!app) throw new Error("Application command hook is unavailable.");
    app.selectClass(className);
  }, name);
  await page.waitForFunction((className: string) => {
    const app: { getSelection: () => readonly string[] } | undefined = (window as Window & { __app?: { getSelection: () => readonly string[] } }).__app;
    return app?.getSelection().length === 1 && app.getSelection()[0] === className && document.querySelector('.cm-content .cm-line')?.textContent === className;
  }, name);
  const editor: import("playwright").Locator = page.getByRole("textbox", { name: "Diagram text", });
  return {
    editor,
    text: (await editor.locator(".cm-line").allTextContents()).join("\n"),
  };
}
export async function waitForLinkLabels(
  labels: readonly string[],
): Promise<void> {
  await page.waitForFunction(
    (expected: readonly string[]) =>
      JSON.stringify(
        [...document.querySelectorAll(".joint-link text")].map(
          (item: Element) => item.textContent,
        ),
      ) === JSON.stringify(expected),
    labels,
  );
}
