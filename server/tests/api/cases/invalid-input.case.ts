import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; reason: string; };
} = {
  title: "rejects malformed class input",
  prompt: {
    availability: "unavailable",
    reason: "Migrated existing coverage.",
  },
};
export function registerInvalidInputCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
      createApp(new MemoryClassRepository()).listen(0, "127.0.0.1");
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
          body: JSON.stringify({ classNames: [] }),
        },
      );
      assert.equal(response.status, 400);
    } finally {
      await new Promise<void>((resolve, reject): void =>
        server.close((error?: Error): void =>
          error === undefined ? resolve() : reject(error),
        ),
      );
    }
  });
}
