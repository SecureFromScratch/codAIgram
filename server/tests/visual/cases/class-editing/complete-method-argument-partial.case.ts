import { test } from "node:test";
import { verifyReferencedHiddenPartial } from "../../support/referenced-partial-class-verification.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "completes a hidden partial class referenced by a method argument",
  prompt: {
    availability: "available",
    text: "A hidden partial class referenced by a method argument can be completed.",
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
