import assert from "node:assert/strict";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import { loggedFetch } from "../../../dist/server_utils.js";
import type { TestCaseMetadata } from "../../test-case-metadata.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "creates an empty project and adds it to the project list",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "Add the server API support needed to create a named empty project and include it in getProjects." }],
  },
};

export function registerCreateProjectCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> = createApp(new MemoryClassRepository([])).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const baseUrl: string = `http://127.0.0.1:${String(address.port)}/api`;
      const created: Response = await loggedFetch(`${baseUrl}/createProject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: "VisualCreatedProject" }),
      });
      assert.equal(created.status, 201);
      const response: Response = await loggedFetch(`${baseUrl}/getProjects`);
      const projectNames: string[] = await response.json() as string[];
      assert.deepEqual(projectNames, ["VisualCreatedProject"]);
      const classesResponse: Response = await loggedFetch(`${baseUrl}/VisualCreatedProject/getClasses`);
      const result: { classes: unknown[] } = await classesResponse.json() as { classes: unknown[] };
      assert.deepEqual(result.classes, []);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      }));
    }
  });
}
