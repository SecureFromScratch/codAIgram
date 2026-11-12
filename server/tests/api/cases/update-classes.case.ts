import assert from "node:assert/strict";
import { loggedFetch } from "../../../dist/utils.js";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import type { ClassDetails } from "../../../dist/memory-repository.js";
import { JsonMap } from "@codaigram/shared/json-map";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "updates classes with every structured member form",
  prompt: {
    availability: "available",
    text: "Update classes with a single-overload method, overloaded method, readonly field, mutable field, and getter/setter property; then read back all details.",
  },
};
export function registerUpdateClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
      createApp(new MemoryClassRepository()).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) =>
        server.once("listening", resolve),
      );
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const base: string = `http://127.0.0.1:${String(address.port)}/api`;
      const updates: ClassDetails[] = [
        {
          name: "NewClass",
          methods: [
            { name: "run", overloads: [[{ arg: "value", t: "string" }]] },
            {
              name: "lookup",
              overloads: [
                [{ arg: "name", t: "string" }],
                [{ arg: "index", t: "number" }],
              ],
            },
            { name: "identifier", overloads: [[{ arg: "+RO", t: "string" }]] },
            { name: "enabled", overloads: [[{ arg: "+RW", t: "boolean" }]] },
            { name: "status", overloads: [[{ arg: "+PROP", t: "Status" }]] },
            {
              name: "configuration",
              overloads: [[{
                arg: "+RO",
                t: new JsonMap<string, string | JsonMap<string, string>>([
                  ["mode", "string"],
                  ["limits", new JsonMap<string, string>([["maximum", "number"]])],
                ]),
              }]],
            },
          ],
          relations: [
            {
              kind: "OWNS",
              name: "owned",
              target: "OwnedClass",
              many: true,
            },
            {
              kind: "REF",
              name: "reference",
              target: "ReferencedClass",
              many: false,
            },
            {
              kind: "UNK",
              name: "unknown",
              target: "UnknownClass",
              many: true,
            },
          ],
          isPartial: false,
        },
        {
          name: "Class",
          methods: [{ name: "inspect", overloads: [[]] }],
          relations: [],
          isPartial: false,
        },
      ];
      const response: Response = await loggedFetch(`${base}/updateClasses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      assert.equal(response.status, 200);
      const read: Response = await loggedFetch(`${base}/classesDetails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classNames: ["NewClass", "Class"] }),
      });
      assert.deepEqual(await read.json(), JSON.parse(JSON.stringify(updates)));
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
  });
}
