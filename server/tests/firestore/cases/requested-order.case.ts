import assert from "node:assert/strict";
import { loggedFetch } from "../../../dist/utils.js";
import type { Server } from "node:net";
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
  test(TEST_CASE_METADATA.title, async () => {
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
          await new FirestoreClassRepository(database, collection).updateClasses([item]);
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
        const response: Response = await loggedFetch(
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
          result.map((item) => item.name),
          ["Class", "ClassDiagram", "Class"],
        );
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
