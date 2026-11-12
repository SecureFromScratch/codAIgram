import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; text: string; };
} = {
  title: "updates and adds test inventory records",
  prompt: {
    availability: "available",
    text: "Replace one test by group and name while adding another.",
  },
};
export function registerUpdateInventoryCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
      createApp(new MemoryClassRepository()).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) =>
        server.once("listening", resolve),
      );
      const address: ReturnType<typeof server.address> = server.address();
      assert.ok(address !== null && typeof address !== "string");
      const baseUrl: string = `http://127.0.0.1:${String(address.port)}/api`;
      const original: {
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
      const update: {
        group: string;
        name: string;
        description: string;
        prompt: string;
      }[] = [
        {
          group: "model",
          name: "parse",
          description: "parses an updated model",
          prompt: "Test updated parsing.",
        },
        {
          group: "api",
          name: "upload",
          description: "uploads inventory",
          prompt: "Test inventory upload.",
        },
      ];
      await fetch(`${baseUrl}/updateTests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(original),
      });
      const response: Response = await fetch(`${baseUrl}/updateTests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      assert.equal(response.status, 200);
      const read: Response = await fetch(`${baseUrl}/getTests`);
      assert.deepEqual(await read.json(), [update[0], original[1], update[1]]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) =>
          error === undefined ? resolve() : reject(error),
        ),
      );
    }
  });
}
