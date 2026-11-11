import { test } from "node:test";
import { getSecondaryClassFixture } from "../../support/secondary-class-support.js";
import { verifySecondaryClassOwnershipEdits } from "../../support/secondary-class-verifications.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "ModificationHistory ownership edits update the correct connector and multiplicity",
  prompt: {
    availability: "available",
    text: "Repeat OWNS editing and multiplicity coverage for ModificationHistory.",
  },
};
export function registerModificationHistoryOwnershipEditsCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    await verifySecondaryClassOwnershipEdits(
      getSecondaryClassFixture("ModificationHistory"),
    );
  });
}
