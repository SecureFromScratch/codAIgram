import assert from "node:assert/strict";
import type { Locator } from "playwright";
import { test } from "node:test";
import type { TestCaseMetadata } from "../../../test-case-metadata.js";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";

const BRIDGE_API_TEXT: string = `BridgeApi
  port: number
  token: string
  getWorkspaceFolders: () => readonly WorkspaceFolderInfo[]`;

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "accepts an arrow-function property type returning readonly workspace folders",
  prompt: {
    availability: "available",
    history: [
      {
        when: "2026/11/25 00:00",
        text: "add a visual test - put this code into the text editor:\n\nBridgeApi\n  port: number\n  token: string\n  getWorkspaceFolders: () => readonly WorkspaceFolderInfo[]\n\nthere should be NO syntax errors",
      },
    ],
  },
};

export function registerFunctionPropertyTypeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor }: Awaited<ReturnType<typeof resetOwnershipEditor>> = await resetOwnershipEditor();
    await editor.fill(BRIDGE_API_TEXT);

    const status: Locator = page.locator(".text-pane .status");
    await page.waitForFunction((expectedText: string) => {
      const actualText: string = Array.from(document.querySelectorAll(".cm-content .cm-line"))
        .map((line: Element) => line.textContent ?? "")
        .join("\n");
      const statusText: string = document.querySelector(".text-pane .status")?.textContent ?? "";
      return actualText === expectedText && (statusText.includes("Diagram is up to date") || statusText.includes("Showing the last valid diagram."));
    }, BRIDGE_API_TEXT);

    assert.equal(await status.innerText(), "Diagram is up to date");
    assert.equal(await editor.locator(".dsl-error").count(), 0);
  });
}
