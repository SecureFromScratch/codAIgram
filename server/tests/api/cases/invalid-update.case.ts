import assert from "node:assert/strict";
import { loggedFetch } from "../../../dist/utils.js";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; reason: string; };
} = {
  title: "rejects invalid updates atomically",
  prompt: {
    availability: "unavailable",
    reason: "Migrated existing coverage.",
  },
};
export function registerInvalidUpdateCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
      createApp(new MemoryClassRepository()).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) =>
        server.once("listening", resolve),
      );
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const response: Response = await loggedFetch(
        `http://127.0.0.1:${String(address.port)}/api/updateClasses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{}]),
        },
      );
      assert.equal(response.status, 400);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
  });
}
