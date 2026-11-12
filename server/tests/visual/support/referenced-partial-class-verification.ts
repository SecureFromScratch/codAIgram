import assert from "node:assert/strict";
import { page } from "../test-support.js";
import { resetOwnershipEditor } from "./editor-support.js";
export async function verifyReferencedHiddenPartial(
  reference: string,
  name: string,
): Promise<void> {
  const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
    await resetOwnershipEditor();
  const owner: string = `${text}\n${reference}`;
  await editor.fill(`${owner}\n\n${name}`);
  await page.locator('[data-class-name="ClassDiagram"]').dblclick();
  await page.waitForFunction(
    (expected: string) =>
      [...document.querySelectorAll(".cm-content .cm-line")]
        .map((line: Element) => line.textContent)
        .join("\n") === expected,
    owner,
  );
  await editor.fill(`${owner}\n\n${name}`);
  assert.equal(await editor.locator(".dsl-error").count(), 0);
  await editor.fill(`${owner}\n\n${name}\n  added()`);
  await page.waitForFunction(
    (className: string) =>
      document
        .querySelector(`[data-class-name="${className}"]`)
        ?.textContent?.includes("added") === true,
    name,
  );
  assert.equal(await editor.locator(".dsl-error").count(), 0);
}
