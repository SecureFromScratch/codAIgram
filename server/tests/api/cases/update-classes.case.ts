import assert from "node:assert/strict";
import { loggedFetch } from "../../../dist/server_utils.js";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import type { ClassDetails } from "../../../dist/memory-repository.js";
import { JsonMap } from "@codaigram/shared/json-map";
import type { ArgsListT } from "@codaigram/shared/class-types";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: { when: string; text: string; }[];
  };
} = {
  title: "updates classes with every structured member form",
  prompt: {
    availability: "available",
    old: "Update classes with a single-overload method, overloaded method, readonly field, mutable field, and getter/setter property; then read back all details.",
  
    history: [
      { when: "2026/11/15 09:35", text: "in server api test - expand classesDetails/updateClasses test to test for the following connection type between classes:\nOWNS\nREF\nUNK\nalso expand these tests to code editor in classes editing page. and the supported dsl." },
      { when: "2026/11/15 09:35", text: "1\\) make sure the api tests try to updateClasses with a mix of single-overload-method, several-overloaded method, radonly variable ,mutable variable, property with get+set\n\nTest that returned classes contain all information updated.\n\n2\\) make sure api tests for updating classes succeed.\n\n3\\) make sure scanner update classes test stores all information ion server and retrieves it back" },
      { when: "2026/11/15 23:42", text: "add a test in scanner - classes that are thrown or used with logAndThrow are marked as usage: ex (add a server supported \"usage\" field to a class's details - modify server tests to check it is supported as well," },
      { when: "2026/11/16 00:00", text: "add a server test - calling getRevisionIds(howFarBack) - returns a reverse datetime ordered list of the revision names stored when updates were perrformed. combine this either as part-of or right-after the tests performing an updateClasses to se if the new revision id is returned. howFarBack of 0 returns latest revision id. after you have theses new tests, add logic to test this also with the mock project tests in scanner. then - finally - you can use this definition for the visual tests.\npencil emoji means arguments are reference-type and mutable. if server doesn't have it yet - add a test to the server that args can be marked as either mutable (m), immutable (x), or readonly (r)" },
    ],
  },
};
type ApiClassUpdateOverloadT = { args: ArgsListT; };
type ApiClassUpdateMethodT = { name: string; overloads: ApiClassUpdateOverloadT[]; };
type ApiClassUpdateT = {
  name: string;
  usage?: ClassDetails['usage'];
  sourceFile?: string;
  modifiedAt?: string;
  methods: ApiClassUpdateMethodT[];
  relations: ClassDetails['relations'];
  state?: ClassDetails['state'];
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
      const base: string = `http://127.0.0.1:${String(address.port)}/api/mock-project`;
      const updates: ClassDetails[] = [
        {
          name: "NewClass",
          usage: "ex",
          sourceFile: "src/new-class.ts",
          modifiedAt: "2026-11-15T09:35:00.000Z",
          methods: [
            { 
              name: "run", 
              overloads: [[
              { arg: "values", t: "string[]", mutability: "m" },
              { arg: "value", t: "string", mutability: "x" },
              { arg: "items", t: "readonly string[]", mutability: "r" },
            ]] 
            },
            {
              name: "lookup",
              overloads: [
                [{ arg: "name", t: "string" }],
                [{ arg: "index", t: "number" }],
              ],
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
              name: "status", 
              overloads: [[{ arg: "+PROP", t: "Status" }]] 
            },
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
          
        },
        {
          name: "Class",
          methods: [{ name: "inspect", overloads: [[]] }],
          relations: [],
          
        },
      ];
      const apiUpdates: ApiClassUpdateT[] = updates.map((item) => {
        const mapped: ApiClassUpdateT = {
          name: item.name,
          methods: item.methods.map((member) => ({
            name: member.name,
            overloads: member.overloads.map((args) => ({ args })),
          })),
          relations: item.relations,
        };
        if (item.usage) mapped.usage = item.usage;
        if (item.sourceFile) mapped.sourceFile = item.sourceFile;
        if (item.modifiedAt) mapped.modifiedAt = item.modifiedAt;
        if (item.state) mapped.state = item.state;
        return mapped;
      });
      const response: Response = await loggedFetch(`${base}/updateClasses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { kind: 'user', name: 'api-test', version: 'v1' },
          classes: apiUpdates,
        }),
      });
      assert.equal(response.status, 200);
      const read: Response = await loggedFetch(`${base}/classesDetails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classNames: ["NewClass", "Class"] }),
      });
      assert.deepEqual(await read.json(), JSON.parse(JSON.stringify(updates)));
      const latest: Response = await loggedFetch(`${base}/getRevisionIds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ howFarBack: 0 }),
      });
      assert.deepEqual(await latest.json(), ["v1"]);
      const second: Response = await loggedFetch(`${base}/updateClasses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { kind: 'user', name: 'api-test', version: 'v2' },
          classes: [{ name: 'NewClass', methods: [], relations: [], }],
        }),
      });
      assert.equal(second.status, 200);
      const history: Response = await loggedFetch(`${base}/getRevisionIds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ howFarBack: 1 }),
      });
      assert.deepEqual(await history.json(), ["v2", "v1"]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
  });
}
