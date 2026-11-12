import { test } from "node:test";
import { getSecondaryClassFixture } from "../../support/secondary-class-support.js";
import { verifySecondaryClassTooltipEdges } from "../../support/secondary-class-verifications.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title:
    "ModificationHistory method tooltip stays within the panel at top and bottom edges",
  prompt: {
    availability: "available",
    text: "Repeat tooltip edge visibility coverage for ModificationHistory.",
  },
};
export function registerModificationHistoryTooltipEdgesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await verifySecondaryClassTooltipEdges(
      getSecondaryClassFixture("ModificationHistory"),
    );
  });
}
