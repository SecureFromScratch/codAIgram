import assert from "node:assert/strict";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import { loggedFetch } from "../../../dist/server_utils.js";
import type { TestCaseMetadata } from "../../test-case-metadata.js";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "getProjects returns all registered project names",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "Add a server API test asserting getProjects returns a list of all project names." }],
  },
};

export function registerGetProjectsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const repository: MemoryClassRepository = new MemoryClassRepository([]);
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> = createApp(repository).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const url: string = `http://127.0.0.1:${String(address.port)}/api`;
      await registerProject(url, "mock-project", "MockTask");
      await registerProject(url, "another", "AnotherTask");
      const response: Response = await loggedFetch(`${url}/getProjects`);
      assert.equal(response.status, 200);
      const projectNames: string[] = await response.json() as string[];
      assert.deepEqual(projectNames, ["another", "mock-project"]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      }));
    }
  });
}

async function registerProject(url: string, projectName: string, className: string): Promise<void> {
  const response: Response = await loggedFetch(`${url}/${projectName}/updateClasses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: { kind: "scan", name: "test-scanner", version: "v1" },
      classes: [{ name: className, methods: [], relations: [] }],
    }),
  });
  assert.equal(response.status, 200);
}
