import { test } from "node:test";
import { getSecondaryClassFixture } from "../../support/secondary-class-support.js";
import { verifySecondaryClassStructure } from "../../support/secondary-class-verifications.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "ModificationHistory has correct isolated-class structure, bounds, highlighting, and badge",
  prompt: {
    availability: "available",
    text: "Repeat DSL and graph behavior coverage for ModificationHistory in isolation.",
  },
};
export function registerModificationHistoryStructureCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    await verifySecondaryClassStructure(
      getSecondaryClassFixture("ModificationHistory"),
    );
  });
}
