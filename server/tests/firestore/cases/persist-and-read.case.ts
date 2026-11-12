import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import {
  createLocalFirestore,
  FirestoreClassRepository,
} from "../../../dist/firestore-repository.js";
import { INITIAL_CLASSES } from "../../../dist/memory-class-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; reason: string; };
} = {
  title: "persists a batch which the details route reads",
  prompt: {
    availability: "unavailable",
    reason: "Migrated existing Firestore integration coverage.",
  },
};
export function registerPersistAndReadCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const database: FirebaseFirestore.Firestore = createLocalFirestore();
    const collection: string = `codaigram_test_${randomUUID().replaceAll("-", "")}`;
    const added: {
      name: string;
      methods: string[];
      relations: never[];
      isPartial: boolean;
    } = {
      name: "IntegrationAdded",
      methods: ["save(value: string)"],
      relations: [],
      isPartial: false,
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
          await database.collection(collection).doc(item.name).create(item);
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
        const address: ReturnType<typeof server.address> = server.address();
        assert.ok(address !== null && typeof address !== "string");
        const base: string = `http://127.0.0.1:${String(address.port)}/api`;
        const changed: {
          name: string;
          methods: string[];
          relations: never[];
          isPartial: boolean;
        } = {
          name: "Class",
          methods: ["inspect()"],
          relations: [],
          isPartial: false,
        };
        const update: Response = await fetch(`${base}/updateClasses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([added, changed]),
        });
        assert.equal(update.status, 200);
        const read: Response = await fetch(`${base}/classesDetails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classNames: [added.name, changed.name] }),
        });
        assert.deepEqual(await read.json(), [added, changed]);
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error?: Error) =>
            error === undefined ? resolve() : reject(error),
          ),
        );
      }
    } finally {
      await database.terminate();
    }
  });
}
