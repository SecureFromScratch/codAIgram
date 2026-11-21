import * as assert from "node:assert";
import { validateWorkspaceRequest } from "@codaigram/bridge-protocol";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "validates workspace sync timestamps without weakening request shape checks",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Carry a workspace sync timestamp through strict request validation." }]
  }
};

export function registerWorkspaceSyncCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const synchronizedChat: object = { version: 1, type: "chat", id: "one", syncTimestamp: 5 };
    assert.deepStrictEqual((await validateWorkspaceRequest(JSON.stringify(synchronizedChat)))._unsafeUnwrap(), { type: "chat", id: "one", syncTimestamp: 5 });
    const promptedChat: object = {
      version: 1,
      type: "chat",
      id: "prompt",
      prompt: "Inspect the project",
      syncTimestamp: 5
    };
    const promptedExpected: object = {
      type: "chat",
      id: "prompt",
      prompt: "Inspect the project",
      syncTimestamp: 5
    };
    assert.deepStrictEqual((await validateWorkspaceRequest(JSON.stringify(promptedChat)))._unsafeUnwrap(), promptedExpected);
    const invalidPromptPing: object = {
      version: 1,
      type: "ping",
      id: "ping",
      prompt: "not allowed"
    };
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify(invalidPromptPing)))._unsafeUnwrapErr(), "Invalid request");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify({ version: 1, type: "chat", id: "one", extra: true })))._unsafeUnwrapErr(), "Invalid request");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify({ version: 1, type: "chat", id: "one", syncTimestamp: -1 })))._unsafeUnwrapErr(), "Invalid sync timestamp");
  });
}
