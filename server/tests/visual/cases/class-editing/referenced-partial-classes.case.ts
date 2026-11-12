import assert from "node:assert/strict";
import { test } from "node:test";
import { page } from "../../test-support.js";
import { resetOwnershipEditor } from "../../support/editor-support.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "allows new and referenced partial classes to be defined and edited",
  prompt: {
    availability: "available",
    text: "A new class name and a partial class referenced as a property, method argument, or OWNS type are valid declarations and can later be completed.",
  },
};
export function registerReferencedPartialClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
      await resetOwnershipEditor();
    const references: string = `${text}\n  property: PropertyType\n  use(value: ArgumentType)\nOWNS owned: OwnedType[]`;
    {
      const __nameValues: readonly string[] = [
        "FreshClass",
        "PropertyType",
        "ArgumentType",
        "OwnedType",
      ];
      for (
        let __nameIndex: number = 0;
        __nameIndex < __nameValues.length;
        __nameIndex += 1
      ) {
        const name: string = __nameValues[__nameIndex]!;
        const source: string = `${references}\n\n${name}`;
        await editor.fill(source);
        assert.equal(
          await editor.locator(".dsl-error").count(),
          0,
          `${name} can be declared`,
        );
        await editor.fill(`${source}\n  added()`);
        await page.waitForFunction(
          (className: string) =>
            document
              .querySelector(`[data-class-name="${className}"]`)
              ?.textContent?.includes("added") === true,
          name,
        );
        assert.equal(await editor.locator(".dsl-error").count(), 0);
      }
    }
  });
}
