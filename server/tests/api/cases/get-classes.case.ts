import assert from "node:assert/strict";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { INITIAL_CLASSES, MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import type { ClassDetails } from "../../../dist/memory-repository.js";
import { loggedFetch } from "../../../dist/utils.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "returns every class and its complete details",
  prompt: {
    availability: "available",
    text: "Add a getClasses API route that returns every class with its details, without requiring separate classesDetails lookups."
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
  isPartial: false
};

export function registerGetClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const repository: MemoryClassRepository = new MemoryClassRepository();
    await repository.updateClasses([CATALOG]);
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> = createApp(repository).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const response: Response = await loggedFetch(`http://127.0.0.1:${String(address.port)}/api/getClasses`);
      assert.equal(response.status, 200);
      const actual: readonly ClassDetails[] = await response.json() as readonly ClassDetails[];
      const expected: readonly ClassDetails[] = [...INITIAL_CLASSES, CATALOG].sort((left: ClassDetails, right: ClassDetails) => left.name.localeCompare(right.name));
      assert.deepEqual(actual, expected);
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
