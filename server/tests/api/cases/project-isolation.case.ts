import assert from "node:assert/strict";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import type { ClassDetails } from "../../../dist/memory-repository.js";
import { loggedFetch } from "../../../dist/server_utils.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: { when: string; text: string }[];
  };
} = {
  title: "stores and returns class inventories separately for each project",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "All server API calls use a project name first. Seed mock-project and another, then verify each gets only its own classes in separate Firestore tenant collections." }],
  },
};

const CLASSES_OF_MOCK_TEST_PROJECT: readonly ClassDetails[] = [
  {
    name: "Task",
    methods: [{ name: "complete", overloads: [[]] }],
    relations: [
      {
        kind: "OWNS",
        name: "contract",
        target: "TaskContract",
        many: false,
      },
    ],
  },
  {
    name: "TaskContract",
    methods: [{
      name: "isSatisfied",
      overloads: [[{ arg: "task", t: "Task" }]],
    }],
    relations: [],
  },
];

const CLASSES_OF_MOCK_TEST_PROJECT_TWO: readonly ClassDetails[] = [
  {
    name: "Task",
    methods: [{
      name: "archive",
      overloads: [[{ arg: "reason", t: "string" }]],
    }],
    relations: [],
  },
  {
    name: "ClassDetails",
    methods: [{ name: "getSummary", overloads: [[]] }],
    relations: [],
  },
];

export function registerProjectIsolationCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
      createApp(new MemoryClassRepository([])).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const base: string = `http://127.0.0.1:${String(address.port)}/api`;

      async function updateClasses(
        projectName: string,
        classes: readonly ClassDetails[],
      ): Promise<void> {
        const response: Response = await loggedFetch(
          `${base}/${projectName}/updateClasses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: { kind: "scan", name: "test-scanner", version: "v1" },
              classes: classes.map((item: ClassDetails) => ({
                name: item.name,
                methods: item.methods.map((member) => ({
                  name: member.name,
                  overloads: member.overloads.map((args) => ({ args })),
                })),
                relations: item.relations,
              })),
            }),
          },
        );
        assert.equal(response.status, 200);
      }

      async function getClasses(projectName: string): Promise<ClassDetails[]> {
        const response: Response = await loggedFetch(
          `${base}/${projectName}/getClasses`,
        );
        assert.equal(response.status, 200);
      const result: ClassesResponse = await response.json() as ClassesResponse;
        return result.classes;
      }

      await updateClasses("mock-project", CLASSES_OF_MOCK_TEST_PROJECT);
      await updateClasses("another", CLASSES_OF_MOCK_TEST_PROJECT_TWO);

      assert.deepEqual(
        await getClasses("mock-project"),
        [...CLASSES_OF_MOCK_TEST_PROJECT].sort((left, right) => left.name.localeCompare(right.name)),
      );
      assert.deepEqual(
        await getClasses("another"),
        [...CLASSES_OF_MOCK_TEST_PROJECT_TWO].sort((left, right) => left.name.localeCompare(right.name)),
      );
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => {
        if (error) reject(error);
        else resolve();
      }));
    }
  });
}

interface ClassesResponse {
  classes: ClassDetails[];
}
