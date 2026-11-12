import { test } from "node:test";
import { getSecondaryClassFixture } from "../../support/secondary-class-support.js";
import { verifySecondaryClassPropertyEdits } from "../../support/secondary-class-verifications.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "Modification property, invalid-syntax, and title edits update only Modification",
  prompt: {
    availability: "available",
    text: "Repeat property and class-title editing coverage for Modification.",
  },
};
export function registerModificationPropertyEditsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await verifySecondaryClassPropertyEdits(
      getSecondaryClassFixture("Modification"),
    );
  });
}
