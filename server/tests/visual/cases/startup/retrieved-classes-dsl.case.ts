import assert from "node:assert/strict";
import { test } from "node:test";
import type { Locator } from "playwright";
import { page, setVisualClasses } from "../../test-support.js";
import { logAndThrow, logVisualEvent } from "../../logging.js";
import type { ClassDetails } from "../../../../dist/memory-repository.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title: "selects every retrieved class and renders its exact DSL in the editor",
  prompt: {
    availability: "available",
    old: "For every class retrieved by the Classes page, select its graph box and verify the editor contains its expected DSL; log the actual editor text as ERROR before a mismatch fails.",
  
    history: [
      { when: "2026/11/15 09:35", text: "add a client/visual test - each retrieved class is selected and the text editor is inspected for the expected textual representation.\nif the textual representation does not match the expected dsl format - the test fails (log actual text in editor as an ERROR log line)" },
    ],
  },
};

type ClassDslExpectationT = { readonly details: ClassDetails; readonly dsl: string; };

const AUDIT_TRAIL: ClassDslExpectationT = {
  details: {
    name: "AuditTrail",
    methods: [
      { 
        name: "record", 
        overloads: [[{ arg: "entry", t: "string" }]] 
      },
      { 
        name: "identifier", 
        overloads: [[{ arg: "+RO", t: "string" }]] 
      },
      { 
        name: "enabled", 
        overloads: [[{ arg: "+RW", t: "boolean" }]] 
      },
      { 
        name: "count", 
        overloads: [[{ arg: "+PROP", t: "number" }]] 
      },
    ],
    relations: [{
      kind: "OWNS",
      name: "events",
      target: "AuditEvent",
      many: true,
    }],
    
  },
  dsl: "AuditTrail\n  record(entry: string)\n  identifier: string\n  enabled: boolean\n  count: number\nOWNS events: AuditEvent[]",
};

const AUDIT_EVENT: ClassDslExpectationT = {
  details: {
    name: "AuditEvent",
    methods: [{ 
      name: "occurredAt", 
      overloads: [[{ arg: "+RO", t: "datetime" }]] 
    }],
    relations: [],
    state: 'partial',
  },
  dsl: "AuditEvent\n  occurredAt: datetime",
};

const AUDIT_SINK: ClassDslExpectationT = {
  details: {
    name: "AuditSink",
    methods: [{ 
      name: "write", 
      overloads: [[{ arg: "event", t: "AuditEvent" }]] 
    }],
    relations: [{
      kind: "REF",
      name: "latest",
      target: "AuditEvent",
      many: false,
    }],
    
  },
  dsl: "AuditSink\n  write(event: AuditEvent)\nREF latest: AuditEvent",
};

const EXPECTATIONS: readonly ClassDslExpectationT[] = [AUDIT_TRAIL, AUDIT_EVENT, AUDIT_SINK];

async function assertSelectedClassDsl(expectation: ClassDslExpectationT): Promise<void> {
  const graphClass: Locator = page.locator(`[data-class-name="${expectation.details.name}"]`);
  await graphClass.dblclick();
  await waitForEditorDsl(expectation);
  const actual: string = await editorDslText();
  if (actual !== expectation.dsl) {
    logVisualEvent("ERROR", `Class editor DSL mismatch for ${expectation.details.name}: expected=${JSON.stringify(expectation.dsl)} actual=${JSON.stringify(actual)}`);
  }
  assert.equal(actual, expectation.dsl);
}

async function waitForEditorDsl(expectation: ClassDslExpectationT): Promise<void> {
  try {
    await page.waitForFunction(
      (expected: string) => Array.from(document.querySelectorAll(".cm-content .cm-line"))
        .map((line: Element) => line.textContent ?? "")
        .join("\n") === expected,
      expectation.dsl,
    );
  } catch (error: unknown) {
    console.error("Could not synchronize the editor after selecting a class.", error);
    logVisualEvent("ERROR", `Could not synchronize the editor while selecting ${expectation.details.name}: ${error instanceof Error ? error.message : "unknown failure"}`);
    const actual: string = await editorDslText();
    logVisualEvent(
      "ERROR",
      `Class editor DSL mismatch for ${expectation.details.name}: expected=${JSON.stringify(expectation.dsl)} actual=${JSON.stringify(actual)}`,
    );
    logAndThrow(error instanceof Error ? error : new Error("The editor did not render the selected class DSL."));
  }
}

async function editorDslText(): Promise<string> {
  const lines: readonly string[] = await page.locator(".cm-content .cm-line").allTextContents();
  return lines.join("\n");
}

export function registerRetrievedClassesDslCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    await setVisualClasses(EXPECTATIONS.map((item: ClassDslExpectationT) => item.details));
    await page.reload();
    await assertSelectedClassDsl(AUDIT_TRAIL);
    await assertSelectedClassDsl(AUDIT_EVENT);
    await assertSelectedClassDsl(AUDIT_SINK);
  });
}
