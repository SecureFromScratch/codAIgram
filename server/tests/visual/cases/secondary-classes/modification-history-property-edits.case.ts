import { test } from "node:test";
import { getSecondaryClassFixture } from "../../support/secondary-class-support.js";
import { verifySecondaryClassPropertyEdits } from "../../support/secondary-class-verifications.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title:
    "ModificationHistory property, invalid-syntax, and title edits update only ModificationHistory",
  prompt: {
    availability: "available",
    old: "Repeat property and class-title editing coverage for ModificationHistory.",
  
    history: [
      { when: "2026/11/15 09:35", text: "repeat all tests performed for the DSL and graph with just one class in the text editor for a second and third class.\nuses these class definitions:\nModification\n  by: string\n  at: datetime\n\nModificationHistory\n  modifications : Modification[]\n  push(newModification: Modification)\n  compact(maxModsToKeep: positive)" },
    ],
  },
};
export function registerModificationHistoryPropertyEditsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await verifySecondaryClassPropertyEdits(
      getSecondaryClassFixture("ModificationHistory"),
    );
  });
}
