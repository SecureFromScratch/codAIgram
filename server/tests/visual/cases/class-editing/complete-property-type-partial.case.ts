import { test } from "node:test";
import { verifyReferencedHiddenPartial } from "../../support/referenced-partial-class-verification.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "completes a hidden partial class referenced by a property type",
  prompt: {
    availability: "available",
    text: "A hidden partial class referenced by a property type can be completed.",
  },
};
export function registerCompletePropertyTypePartialCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    await verifyReferencedHiddenPartial(
      "  field: PropertyType",
      "PropertyType",
    );
  });
}
