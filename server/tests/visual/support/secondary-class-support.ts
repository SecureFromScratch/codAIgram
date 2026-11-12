import type { Locator } from "playwright";
import { page } from "../test-support.js";
import { logAndThrow } from "../logging.js";
import { resetOwnershipEditor } from "./editor-support.js";
export type SecondaryClassFixtureT = {
  readonly name: string;
  readonly source: string;
  readonly members: readonly string[];
};
export type SecondaryClassIsolationT = {
  readonly editor: import("playwright").Locator;
  readonly selected: SecondaryClassFixtureT;
};
export const SECONDARY_CLASSES: readonly SecondaryClassFixtureT[] = [
  {
    name: "Modification",
    source: "Modification\n  by: string\n  at: datetime",
    members: ["by: string", "at: datetime"],
  },
  {
    name: "ModificationHistory",
    source:
      "ModificationHistory\n  modifications : Modification[]\n  push(newModification: Modification)\n  compact(maxModsToKeep: positive)",
    members: ["modifications : Modification[]", "push", "compact"],
  },
];
export function getSecondaryClassFixture(name: string): SecondaryClassFixtureT {
  const fixture: SecondaryClassFixtureT | undefined = SECONDARY_CLASSES.find(
    (item: SecondaryClassFixtureT) => item.name === name,
  );
  if (!fixture)
    logAndThrow(new Error(`No secondary class fixture named ${name}.`));
  return fixture;
}
export async function isolateSecondaryClass(
  name: string,
): Promise<SecondaryClassIsolationT> {
  const { editor, text }: Awaited<ReturnType<typeof resetOwnershipEditor>> =
    await resetOwnershipEditor();
  await editor.fill(
    `${text}\n\n${SECONDARY_CLASSES.map((item: SecondaryClassFixtureT) => item.source).join("\n\n")}`,
  );
  const target: import("playwright").Locator = page.locator(
    `[data-class-name="${name}"]`,
  );
  await target.waitFor();
  await target.dblclick();
  const selected: SecondaryClassFixtureT = getSecondaryClassFixture(name);
  await page.waitForFunction(
    (expected: string) =>
      [...document.querySelectorAll(".cm-content .cm-line")]
        .map((line: Element) => line.textContent)
        .join("\n") === expected,
    selected.source,
  );
  return { editor, selected };
}
