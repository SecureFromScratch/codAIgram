import assert from "node:assert/strict";
import { loggedFetch } from "../../../dist/utils.js";
import type { Server } from "node:net";
import { test } from "node:test";
import { createApp } from "../../../dist/app.js";
import { MemoryClassRepository } from "../../../dist/memory-class-repository.js";
import type { ClassDetails } from "../../../dist/memory-repository.js";
export const TEST_CASE_METADATA: {
  title: string;
  prompt: { availability: string; reason: string; };
} = {
  title: "returns requested class details",
  prompt: {
    availability: "unavailable",
    reason: "Migrated existing API coverage.",
  },
};
export function registerClassDetailsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const repository: MemoryClassRepository = new MemoryClassRepository();
    const connections: ClassDetails = {
      name: "RelationshipSource",
      methods: [],
      relations: [
        {
          kind: "OWNS",
          name: "owned",
          target: "OwnedClass",
          many: true,
        },
        {
          kind: "REF",
          name: "reference",
          target: "ReferencedClass",
          many: false,
        },
        {
          kind: "UNK",
          name: "unknown",
          target: "UnknownClass",
          many: true,
        },
      ],
      isPartial: false,
    };
    await repository.updateClasses([connections]);
    const server: ReturnType<ReturnType<typeof createApp>["listen"]> =
      createApp(repository).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) =>
        server.once("listening", resolve),
      );
      const address: ReturnType<Server["address"]> = server.address();
      assert.ok(address && typeof address !== "string");
      const response: Response = await loggedFetch(
        `http://127.0.0.1:${String(address.port)}/api/classesDetails`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classNames: ["ClassDiagram", "Class", "RelationshipSource", "Unknown"],
          }),
        },
      );
      assert.equal(response.status, 200);
      const result: readonly ClassDetails[] = await response.json() as readonly ClassDetails[];
      assert.deepEqual(result.map((item) => item.name), ["ClassDiagram", "Class", "RelationshipSource"]);
      const relationshipSource: ClassDetails | undefined = result.find((item: ClassDetails) => item.name === "RelationshipSource");
      assert.deepEqual(relationshipSource?.relations, connections.relations);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }
  });
}
