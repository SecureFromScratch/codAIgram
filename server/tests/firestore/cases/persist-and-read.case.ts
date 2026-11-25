import assert from "node:assert/strict";
import { loggedFetch } from "../../../dist/server_utils.js";
import type { Server } from "node:net";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import {
  createLocalFirestore,
  FirestoreClassRepository,
} from "../../../dist/firestore-repository.js";
import { INITIAL_CLASSES } from "../../../dist/memory-class-repository.js";
import type { ClassDetails } from "../../../dist/memory-repository.js";
import type { ClassUpdate } from "../../../dist/class-revision.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    reason: string;
    history: { when: string; text: string; }[];
  };
} = {
  title: "persists a batch which the details route reads",
  prompt: {
    availability: "unavailable",
    reason: "Migrated existing Firestore integration coverage.",
  
    history: [],
  },
};
export function registerPersistAndReadCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const database: FirebaseFirestore.Firestore = createLocalFirestore();
    const collection: string = `codaigram_test_${randomUUID().replaceAll("-", "")}`;
    const added: ClassDetails = {
      name: "IntegrationAdded",
      methods: [{ 
        name: "save", 
        overloads: [[{ arg: "value", t: "string" }]] 
      }],
      relations: [],
      
    };
    try {
      {
        const __itemValues: readonly (typeof INITIAL_CLASSES)[number][] =
          INITIAL_CLASSES;
        for (
          let __itemIndex: number = 0;
          __itemIndex < __itemValues.length;
          __itemIndex += 1
        ) {
          const item: (typeof INITIAL_CLASSES)[number] =
            __itemValues[__itemIndex]!;
          await new FirestoreClassRepository(database, collection).updateClasses("mock-project", [item]);
        }
      }
      const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
        createApp(new FirestoreClassRepository(database, collection)).listen(
          0,
          "127.0.0.1",
        );
      try {
        await new Promise<void>((resolve) =>
          server.once("listening", resolve),
        );
        const address: ReturnType<Server["address"]> = server.address();
        assert.ok(address && typeof address !== "string");
        const base: string = `http://127.0.0.1:${String(address.port)}/api/mock-project`;
        const changed: ClassDetails = {
          name: "Class",
          methods: [{ name: "inspect", overloads: [[]] }],
          relations: [],
          
        };
        const apiClasses: ClassUpdate[] = [added, changed].map((item: ClassDetails) => {
          const mapped: ClassUpdate = {
            name: item.name,
            methods: item.methods.map((member) => ({
              name: member.name,
              overloads: member.overloads.map((args) => ({ args })),
            })),
            relations: item.relations,
          };
          if (item.state) mapped.state = item.state;
          return mapped;
        });
        const update: Response = await loggedFetch(`${base}/updateClasses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: { kind: 'user', name: 'firestore-test', version: 'v1' },
            classes: apiClasses,
          }),
        });
        assert.equal(update.status, 200);
        const read: Response = await loggedFetch(`${base}/classesDetails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classNames: [added.name, changed.name] }),
        });
        assert.deepEqual(await read.json(), [added, changed]);
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error?: Error) =>
            error ? reject(error) : resolve(),
          ),
        );
      }
    } finally {
      await database.terminate();
    }
  });
}
