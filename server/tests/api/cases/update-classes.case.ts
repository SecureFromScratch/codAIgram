import assert from "node:assert/strict";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import type { ClassDetails } from "../../../dist/memory-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; reason: string; };
} = {
  title: "updates classes",
  prompt: {
    availability: "unavailable",
    reason: "Migrated existing coverage.",
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
          methods: ["run(value: string)"],
          relations: [],
          isPartial: false,
        },
        {
          name: "Class",
          methods: ["inspect()"],
          relations: [],
          isPartial: false,
        },
      ];
      const response: Response = await fetch(`${base}/updateClasses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      assert.equal(response.status, 200);
      const read: Response = await fetch(`${base}/classesDetails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classNames: ["NewClass", "Class"] }),
      });
      assert.deepEqual(await read.json(), updates);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
  });
}
