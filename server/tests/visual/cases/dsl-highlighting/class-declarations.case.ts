import assert from "node:assert/strict";
import { test } from "node:test";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "styles every class declaration in the editor",
  prompt: {
    availability: "available",
    text: "Find every class name in the text editor and verify its color, bold, italic, and underline styles.",
  },
};
export function registerClassDeclarationHighlightingCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const source: string = `${text}\n\nModification\n  by: string\n  at: datetime\n\nModificationHistory\n  modifications: Modification[]\n  push(newModification: Modification)\n\nPartial`;
    await editor.fill(source);
    const declarations: readonly {
      readonly name: string | null;
      readonly marked: string | null;
      readonly color: string | undefined;
      readonly weight: string | undefined;
      readonly italic: string | undefined;
      readonly decoration: string | undefined;
    }[] = await editor.locator(".cm-line").evaluateAll(
      (
        lines: readonly Element[],
      ): readonly {
        readonly name: string | null;
        readonly marked: string | null;
        readonly color: string | undefined;
        readonly weight: string | undefined;
        readonly italic: string | undefined;
        readonly decoration: string | undefined;
      }[] =>
        lines
          .filter((line: Element): boolean =>
            /^[A-Za-z_][A-Za-z0-9_]*$/.test(line.textContent ?? ""),
          )
          .map((line: Element) => {
            const span: HTMLElement | null =
              line.querySelector<HTMLElement>(".dsl-class-name");
            const style: CSSStyleDeclaration | undefined =
              span === null ? undefined : getComputedStyle(span);
            return {
              name: line.textContent,
              marked: span?.textContent ?? null,
              color: style?.color,
              weight: style?.fontWeight,
              italic: style?.fontStyle,
              decoration: style?.textDecorationLine,
            };
          }),
    );
    assert.deepEqual(
      declarations.map((item) => item.name),
      ["ClassDiagram", "Modification", "ModificationHistory", "Partial"],
    );
    {
      const __itemValues: readonly {
        readonly name: string | null;
        readonly marked: string | null;
        readonly color: string | undefined;
        readonly weight: string | undefined;
        readonly italic: string | undefined;
        readonly decoration: string | undefined;
      }[] = declarations;
      for (
        let __itemIndex: number = 0;
        __itemIndex < __itemValues.length;
        __itemIndex += 1
      ) {
        const item: {
          readonly name: string | null;
          readonly marked: string | null;
          readonly color: string | undefined;
          readonly weight: string | undefined;
          readonly italic: string | undefined;
          readonly decoration: string | undefined;
        } = __itemValues[__itemIndex]!;
        assert.equal(
          item.marked,
          item.name,
          `${item.name ?? "unnamed"} is fully highlighted`,
        );
        assert.equal(
          item.color,
          "rgb(38, 60, 115)",
          `${item.name ?? "unnamed"} color`,
        );
        assert.ok(
          Number(item.weight) >= 700,
          `${item.name ?? "unnamed"} is bold`,
        );
        assert.equal(
          item.italic,
          "italic",
          `${item.name ?? "unnamed"} is italic`,
        );
        assert.ok(
          item.decoration?.includes("underline") === true,
          `${item.name ?? "unnamed"} is underlined`,
        );
      }
    }
  });
}
