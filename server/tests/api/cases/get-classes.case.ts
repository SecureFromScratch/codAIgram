import assert from "node:assert/strict";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { INITIAL_CLASSES, MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import type { ClassDetails } from "../../../dist/memory-repository.js";
import { loggedFetch } from "../../../dist/server_utils.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: {
      when: string;
      text: string;
    }[];
  };
} = {
  title: "returns every class and its complete details",
  prompt: {
    availability: "available",
    old: "Add a getClasses API route that returns every class with its details, without requiring separate classesDetails lookups."
  ,
    history: [
      { when: "2026/11/16 11:45", text: "this is the server's response to getClasses. obviously not in the new format - there's an isPartial field there... this could be starting from the tests - check server api tests that they expect a state field and not isPartial. this will propagate to all tests relying on isPartial - change to state field" },
      { when: "2026/11/15 09:35", text: "add a server api test: the route getClasses returns all classes and their details (no separate classesDetails call is needed)" },
      { when: "2026/11/16 14:38", text: "getClasses() currently returns a lot of historical information that it shouldn't: the origin, change time etc should only be in the lastChange field. The correct way: getClassesHistory returns changes history, per selected class. getClasses only returns changes for the latest change, as list in the end." },
    ],
  }
};

const CATALOG: ClassDetails = {
  name: "Catalog",
  methods: [{ name: "find", overloads: [[{ arg: "name", t: "string" }]] }],
  relations: [{
    kind: "REF",
    name: "entries",
    target: "Entry",
    many: true
  }],
  };

export function registerGetClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const repository: MemoryClassRepository = new MemoryClassRepository();
    await repository.updateClasses("mock-project", [CATALOG]);
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> = createApp(repository).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const response: Response = await loggedFetch(`http://127.0.0.1:${String(address.port)}/api/mock-project/getClasses`);
      assert.equal(response.status, 200);
      const result: { classes: readonly ClassDetails[] } = await response.json() as { classes: readonly ClassDetails[] };
      const actual: readonly ClassDetails[] = result.classes;
      const expected: readonly ClassDetails[] = [...INITIAL_CLASSES, CATALOG].sort((left: ClassDetails, right: ClassDetails) => left.name.localeCompare(right.name));
      assert.deepEqual(actual, expected);
      assert.equal(actual.find((item: ClassDetails) => item.name === 'Class')?.state, 'partial');
      assert.ok(actual.every((item: ClassDetails) => !('isPartial' in item)));
      assert.ok(!('state' in CATALOG));
      actual.forEach((item: ClassDetails) => {
        assert.ok(!('origin' in item));
        assert.ok(!('changedAt' in item));
        item.methods.forEach((member) => {
          assert.ok(!('origin' in member));
          assert.ok(!('changedAt' in member));
          member.overloads.forEach((overload) => overload.forEach((field) => {
            assert.ok(!('origin' in field));
            assert.ok(!('changedAt' in field));
          }));
        });
        item.relations.forEach((relation) => {
          assert.ok(!('origin' in relation));
          assert.ok(!('changedAt' in relation));
        });
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => {
        // UNTRUST-ALLOW-NULLISH: Node's Server.close callback uses undefined to represent successful closure; this test must distinguish that documented success sentinel from an Error without treating it as a domain null value.
        if (error === undefined) {
          resolve();
          return;
        }
        reject(error);
      }));
    }
  });
}
