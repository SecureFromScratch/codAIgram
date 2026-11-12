import { test } from "node:test";
import { getSecondaryClassFixture } from "../../support/secondary-class-support.js";
import { verifySecondaryClassMethodEdits } from "../../support/secondary-class-verifications.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "Modification method add, rename, delete, and undo update only Modification",
  prompt: {
    availability: "available",
    text: "Repeat method editing and undo coverage for Modification.",
  },
};
export function registerModificationMethodEditsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await verifySecondaryClassMethodEdits(
      getSecondaryClassFixture("Modification"),
    );
  });
}
