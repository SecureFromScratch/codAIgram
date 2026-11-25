import type { Locator } from "playwright";
import assert from "node:assert/strict";
import { test } from "node:test";
import { page, setVisualClasses } from "../../test-support.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: { when: string; text: string }[];
  };
} = {
  title: "opens a class context menu and edits its connected class chain",
  prompt: {
    availability: "available",
    history: [
      { when: "2026/11/18 09:35", text: "add test: right clicking a classbox opens a context-menu. add test: the context-menu has an option called Edit chain (search by label, don't depend on its index). choosing it loads the clicked class first and all recursively connected classes into the editor using a DFS-style search; order after the first class is not important.", },
    ],
  },
};

export function registerEditChainContextMenuCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses([
      {
        name: "Root",
        methods: [],
        relations: [
          { 
            kind: "OWNS", 
            name: "first", 
            target: "ChildA", 
            many: false 
          },
          { 
            kind: "REF", 
            name: "second", 
            target: "ChildB", 
            many: false 
          },
        ],
      },
      {
        name: "ChildA",
        methods: [],
        relations: [{ kind: "REF", name: "leaf", target: "Leaf", many: false }],
      },
      {
        name: "ChildB",
        methods: [],
        relations: [{ kind: "REF", name: "leaf", target: "Leaf", many: false }],
      },
      { name: "Leaf", methods: [], relations: [] },
      { name: "Isolated", methods: [], relations: [] },
    ]);
    await page.reload();
    await page.locator('[data-class-name="Root"]').waitFor();

    await page.locator('[data-class-name="Root"]').click({ button: "right" });
    const menu: Locator = page.getByRole("menu", { name: "Class actions", });
    await menu.waitFor();
    const editChain: Locator = menu.getByRole("menuitem", { name: "Edit chain", });
    await editChain.waitFor();
    await editChain.click();

    const editor: Locator = page.getByRole("textbox", { name: "Diagram text", });
    await page.waitForFunction(() =>
      document.querySelector(".cm-content")?.textContent?.includes("ChildA") === true,
    );
    const lines: string[] = await editor.locator(".cm-line").allTextContents();
    const classNames: readonly string[] = ["Root", "ChildA", "ChildB", "Leaf", "Isolated"];
    const displayedClasses: string[] = lines.filter((line: string) =>
      classNames.includes(line.trim()),
    );

    assert.equal(displayedClasses.at(0), "Root");
    assert.deepEqual(new Set(displayedClasses), new Set(["Root", "ChildA", "ChildB", "Leaf"]));
    assert.equal(await menu.count(), 0);
  });
}
