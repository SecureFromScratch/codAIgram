import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: {
      when: string;
      text: string;
    }[];
  };
} = {
  title:
    "updates multiple classes and reconnects ownership when a target is renamed",
  prompt: {
    availability: "available",
    old: "Multiple classes are separated by a blank line; editing the second class updates the graph, renaming ownership targets reconnects the relation, and duplicate names or missing separators report diagnostics.",
  
    history: [
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error\nperforming changes on the second classes affects the visual graph:\nadd as the second class (in the test):\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nand a third class:\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nlines where there are no parantheses on the action - it is a property (defaults to readonly)\na type field specified as [X, Y, Z] - this is a discrete enum. if you know for a more standard way to specify it inline please advise." },
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error" },
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error\nperforming changes on the second classes affects the visual graph:\nadd as the second class (in the test):\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nand a third class:\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nlines where there are no parantheses on the action - it is a property (defaults to readonly)\na type field specified as [X, Y, Z] - this is a discrete enum. if you know for a more standard way to specify it inline please advise.\n\nTests:\ntest dsl validates this syntax. add a test where you omit the colon from the property or the type (property MUST have a type specifier)" },
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error\nperforming changes on the second classes affects the visual graph:\nadd as the second class (in the test):\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nand a third class:\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nlines where there are no parantheses on the action - it is a property (defaults to readonly)\na type field specified as [X, Y, Z] - this is a discrete enum. if you know for a more standard way to specify it inline please advise.\n\nTests:\ntest dsl validates this syntax. add a test where you omit the colon from the property or the type (property MUST have a type specifier)\ntest: rename Class to Class1 - that should cause a new classbox for class [partially defined by ClassDiagram) to be created and the connector to be connected to it. once Class1 is renamed back to Class - the connector reconnects to Class." },
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error\nperforming changes on the second classes affects the visual graph:\nadd as the second class (in the test):\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nand a third class:\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nlines where there are no parantheses on the action - it is a property (defaults to readonly)\na type field specified as [X, Y, Z] - this is a discrete enum. if you know for a more standard way to specify it inline please advise.\n\nTests:\ntest dsl validates this syntax. add a test where you omit the colon from the property or the type (property MUST have a type specifier)\ntest: rename Class to Class1 - that should cause a new classbox for class [partially defined by ClassDiagram) to be created and the connector to be connected to it. once Class1 is renamed back to Class - the connector reconnects to Class.\ntest: renaming Class to ClassDiagram - this should fail due to a conflict." },
      { when: "2026/11/15 09:35", text: "add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.\nremoving the empty line between classes generates a syntax error\nperforming changes on the second classes affects the visual graph:\nadd as the second class (in the test):\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nand a third class:\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime\n\nlines where there are no parantheses on the action - it is a property (defaults to readonly)\na type field specified as [X, Y, Z] - this is a discrete enum. if you know for a more standard way to specify it inline please advise.\n\nTests:\ntest dsl validates this syntax. add a test where you omit the colon from the property or the type (property MUST have a type specifier)\ntest: rename Class to Class1 - that should cause a new classbox for class [partially defined by ClassDiagram) to be created and the connector to be connected to it. once Class1 is renamed back to Class - the connector reconnects to Class.\ntest: renaming Class to ClassDiagram - this should fail due to a conflict.\ntest: red-wavy-underlined text, when hovered, reports the problem in a tooltip." },
    ],
  },
};
export function registerMultipleClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const extra: "\n\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime" =
      "\n\nClass\n  isPartial : bool\n  modifications: ModificationRecord[]\n  addModification(ModificationRecord)\n\nModificationRecord\n  by: [AI, Human, Scan]\n  at: datetime";
    const source: string = text + extra;
    await editor.fill(source);
    await page.locator('[data-class-name="ModificationRecord"]').waitFor();
    assert.equal(await editor.locator(".dsl-error").count(), 0);
    const classBox: import("playwright").Locator = page.locator(
      '[data-class-name="Class"]',
    );
    assert.ok(((await classBox.textContent()) ?? "").includes("modifications"));
    await editor.fill(source.replace("isPartial : bool", "isComplete : bool"));
    await page.waitForFunction(() =>
      (document.querySelector('[data-class-name="Class"]')?.textContent ?? "")
        .includes("isComplete : bool"),
    );
    await editor.fill(source);
    await editor.fill(source.replace("\n\nClass\n", "\n\nClass1\n"));
    await page
      .locator('[data-class-name="Class"].joint-type-standard-rectangle')
      .waitFor();
    assert.equal(await page.locator('[data-class-name="Class1"]').count(), 1);
    await editor.fill(source);
    await page
      .locator('[data-class-name="Class"].joint-type-standard-headeredrectangle')
      .waitFor();
    await editor.fill(source.replace("\n\nClass\n", "\n\nClassDiagram\n"));
    const conflict: import("playwright").Locator = editor
      .locator(".dsl-error")
      .filter({ hasText: "ClassDiagram" });
    await conflict.first().waitFor();
    assert.match(
      (await conflict.first().getAttribute("title")) ?? "",
      /Duplicate class name/,
    );
    await conflict.first().hover();
    await page
      .locator(".dsl-diagnostic-tooltip")
      .filter({ hasText: "Duplicate class name: ClassDiagram." })
      .waitFor();
    await editor.fill(source.replace("\n\nClass\n", "\nClass\n"));
    const separator: import("playwright").Locator = editor
      .locator(".dsl-error")
      .filter({ hasText: "Class" });
    await separator.first().waitFor();
    assert.match(
      (await separator.first().getAttribute("title")) ?? "",
      /blank line/,
    );
  });
}
