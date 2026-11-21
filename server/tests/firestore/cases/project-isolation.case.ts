import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createLocalFirestore, FirestoreClassRepository } from "../../../dist/firestore-repository.js";
import type { ClassOrigin, ClassUpdate, CurrentClass } from "../../../dist/class-revision.js";

export const TEST_CASE_METADATA: {
  title: string;
  prompt: {
    availability: string;
    history: { when: string; text: string }[];
  };
} = {
  title: "stores Firestore class snapshots in separate project collections",
  prompt: {
    availability: "available",
    history: [{ when: "2026/11/18 09:35", text: "Firestore stores each project's class snapshots and history in a tenant collection; verify matching class names stay isolated." }],
  },
};

export function registerProjectIsolationCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const database: FirebaseFirestore.Firestore = createLocalFirestore();
    const collection: string = `project_isolation_${randomUUID().replaceAll("-", "")}`;
    const repository: FirestoreClassRepository = new FirestoreClassRepository(database, collection);
    const origin: ClassOrigin = { kind: "scan", name: "test-scanner", version: "v1" };
    const mockProjectClass: ClassUpdate = {
      name: "SharedTask",
      methods: [{ name: "complete", overloads: [{ args: [] }] }],
      relations: [],
    };
    const anotherProjectClass: ClassUpdate = {
      name: "SharedTask",
      methods: [{
        name: "archive",
        overloads: [{ args: [{ arg: "reason", t: "string" }] }],
      }],
      relations: [],
    };

    try {
      await repository.updateClassSnapshots("mock-project", [mockProjectClass], origin);
      const anotherOrigin: ClassOrigin = { kind: "scan", name: "test-scanner", version: "v2" };
      await repository.updateClassSnapshots("another", [anotherProjectClass], anotherOrigin);

      const mockProjectClasses: CurrentClass[] = await repository.getClassSnapshots("mock-project");
      const anotherProjectClasses: CurrentClass[] = await repository.getClassSnapshots("another");
      const projectNames: string[] = await repository.getProjects();
      assert.ok(projectNames.includes("mock-project"));
      assert.ok(projectNames.includes("another"));
      assert.deepEqual(mockProjectClasses.map((item) => item.name), ["SharedTask"]);
      assert.deepEqual(anotherProjectClasses.map((item) => item.name), ["SharedTask"]);
      assert.equal(mockProjectClasses[0]?.methods[0]?.name, "complete");
      assert.equal(anotherProjectClasses[0]?.methods[0]?.name, "archive");
      assert.equal((await repository.getClassHistory("mock-project", ["SharedTask"]))[0]?.methods[0]?.name, "complete");
      assert.equal((await repository.getClassHistory("another", ["SharedTask"]))[0]?.methods[0]?.name, "archive");
    } finally {
      const projectNames: string[] = ["mock-project", "another"];
      const collectionNames: string[] = [
        collection,
        `${collection}_snapshots`,
        `${collection}_metadata`,
        `${collection}_revision_ids`,
        `${collection}_class_guids`,
      ];
      const cleanupTasks: Promise<void>[] = projectNames.flatMap((projectName: string) => collectionNames.map(async (suffix: string) => {
        await database.recursiveDelete(database.collection(`projects/${projectName}/${suffix}`));
      }));
      await Promise.all(cleanupTasks);
      await database.terminate();
    }
  });
}
