import assert from "node:assert/strict";
import { loggedFetch } from "../../../dist/server_utils.js";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    [archivedField: string]: unknown;
    history: {
      when: string;
      text: string;
    }[];
  };
} = {
  title: "updates and adds tests inventory records",
  prompt: {
    availability: "available",
    old: "Replace one test by group and name while adding another.",
  
    history: [
      { when: "2026/11/15 09:35", text: "another server tests is calling updateTests with 1 new (mock test info and 1 updated test info. perform getTests and check we get 3 correct tests info." },
    ],
  },
};
export function registerUpdateTestsInventoryCase(): void {
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
      await loggedFetch(`${baseUrl}/updateTests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(original),
      });
      const response: Response = await loggedFetch(`${baseUrl}/updateTests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      assert.equal(response.status, 200);
      const read: Response = await loggedFetch(`${baseUrl}/getTests`);
      const entries = await read.json() as { group: string; name: string; description: string; lastChangedAt: string }[];
      assert.deepEqual(entries.map(({ group, name, description }) => ({ group, name, description })), [update[0]!, original[1]!, update[1]!].map(({ group, name, description }) => ({ group, name, description })));
      entries.forEach((entry) => { assert.ok(!('prompt' in entry)); assert.ok(!Number.isNaN(Date.parse(entry.lastChangedAt))); });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
  });
}
