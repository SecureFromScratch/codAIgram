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
    history: { when: string; text: string; }[];
  };
} = {
  title: "stores an initial tests inventory",
  prompt: {
    availability: "available",
    old: "Store two tests and return them unchanged.",
  
    history: [
      { when: "2026/11/15 09:35", text: "add an in-memory codaigram test: start with an empty in-memory db. call updateTests route with 2 mock tests info, call getTests route and check that returned tests are the same as initially pushed." },
    ],
  },
};
export function registerInitialTestsInventoryCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
      createApp(new MemoryClassRepository()).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) =>
        server.once("listening", resolve),
      );
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const baseUrl: string = `http://127.0.0.1:${String(address.port)}/api/mock-project`;
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
      const update: Response = await loggedFetch(`${baseUrl}/updateTests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tests),
      });
      assert.equal(update.status, 200);
      const read: Response = await loggedFetch(`${baseUrl}/getTests`);
      assert.equal(read.status, 200);
      const entries: { 
        group: string; 
        name: string; 
        description: string; 
        lastChangedAt: string; 
      }[] = await read.json() as { 
        group: string; 
        name: string; 
        description: string; 
        lastChangedAt: string 
      }[];
      assert.deepEqual(entries.map(({ group, name, description }) => ({ group, name, description })), tests.map(({ group, name, description }) => ({ group, name, description })));
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
