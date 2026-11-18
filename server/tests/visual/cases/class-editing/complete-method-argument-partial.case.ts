import { test } from "node:test";
import { verifyReferencedHiddenPartial } from "../../support/referenced-partial-class-verification.js";
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
  title: "completes a hidden partial class referenced by a method argument",
  prompt: {
    availability: "available",
    old: "A hidden partial class referenced by a method argument can be completed.",
  
    history: [
      { when: "2026/11/15 09:35", text: "test: in the editor - if the name of a new class is written - it is ok (no error). if the name of a partial class mentioned by another class in the editor (either as a property type, method arg or references, such as OWNS) - it is ok, and changing it (i.e. by adding methods) changes that class." },
    ],
  },
};
export function registerCompleteMethodArgumentPartialCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await verifyReferencedHiddenPartial(
      "  accept(value: ArgumentType)",
      "ArgumentType",
    );
  });
}
