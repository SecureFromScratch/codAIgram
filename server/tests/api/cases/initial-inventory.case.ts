import assert from "node:assert/strict";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "stores an initial test inventory",
  prompt: {
    availability: "available",
    text: "Store two tests and return them unchanged.",
  },
};
export function registerInitialInventoryCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
      createApp(new MemoryClassRepository()).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) =>
        server.once("listening", resolve),
      );
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const baseUrl: string = `http://127.0.0.1:${String(address.port)}/api`;
      const tests: {
        group: string;
        name: string;
        description: string;
        prompt: string;
      }[] = [
        {
          group: "model",
          name: "parse",
          description: "parses a model",
          prompt: "Test parsing.",
        },
        {
          group: "model",
          name: "render",
          description: "renders a model",
          prompt: "Test rendering.",
        },
      ];
      const update: Response = await fetch(`${baseUrl}/updateTests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tests),
      });
      assert.equal(update.status, 200);
      const read: Response = await fetch(`${baseUrl}/getTests`);
      assert.equal(read.status, 200);
      assert.deepEqual(await read.json(), tests);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
  });
}
