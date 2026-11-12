import { test } from "node:test";
import { getSecondaryClassFixture } from "../../support/secondary-class-support.js";
import { verifySecondaryClassStructure } from "../../support/secondary-class-verifications.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "Modification has correct isolated-class structure, bounds, highlighting, and badge",
  prompt: {
    availability: "available",
    text: "Repeat DSL and graph behavior coverage for the Modification class in isolation.",
  },
};
export function registerModificationStructureCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await verifySecondaryClassStructure(
      getSecondaryClassFixture("Modification"),
    );
  });
}
