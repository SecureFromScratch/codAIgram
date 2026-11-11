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
  title: "preserves requested order and duplicates",
  prompt: {
    availability: "unavailable",
    reason: "Migrated existing Firestore integration coverage.",
  },
};
export function registerRequestedOrderCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const database: FirebaseFirestore.Firestore = createLocalFirestore();
    const collection: string = `codaigram_test_${randomUUID().replaceAll("-", "")}`;
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
        await new Promise<void>((resolve): void =>
          server.once("listening", resolve),
        );
        const address: ReturnType<typeof server.address> = server.address();
        assert.ok(address !== null && typeof address !== "string");
        const response: Response = await fetch(
          `http://127.0.0.1:${String(address.port)}/api/classesDetails`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classNames: ["Class", "Missing", "ClassDiagram", "Class"],
            }),
          },
        );
        const result: readonly { readonly name: string; }[] = (await response.json()) as readonly { readonly name: string; }[];
        assert.deepEqual(
          result.map((item): string => item.name),
          ["Class", "ClassDiagram", "Class"],
        );
      } finally {
        await new Promise<void>((resolve, reject): void =>
          server.close((error?: Error): void =>
            error === undefined ? resolve() : reject(error),
          ),
        );
      }
    } finally {
      await database.terminate();
    }
  });
}
