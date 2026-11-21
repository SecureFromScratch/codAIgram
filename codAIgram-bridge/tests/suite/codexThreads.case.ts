import * as assert from "node:assert";
import { ok } from "neverthrow";
import { CodexThreadManager } from "../../src/codexThreads";
import type { CodexThreadMappingStoreT, CodexThreadRequestT } from "../../src/codexThreads";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "associates conversations with started and resumed Codex threads",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Create and resume Codex threads with conversation mappings." }]
  }
};

export function registerCodexThreadsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const stored: Map<string, string> = new Map<string, string>();
    const calls: string[] = [];
    const mappings: CodexThreadMappingStoreT = {
      read: (conversationId) => stored.get(conversationId),
      write: (conversationId, threadId) => { stored.set(conversationId, threadId); }
    };
    const request: CodexThreadRequestT = async (method) => {
      calls.push(method);
      return ok({ thread: { id: "thread-1" } });
    };
    const manager: CodexThreadManager = new CodexThreadManager(request, mappings);
    assert.strictEqual((await manager.start("conversation-1", "C:\\workspace"))._unsafeUnwrap(), "thread-1");
    assert.strictEqual((await manager.resume("conversation-1"))._unsafeUnwrap(), "thread-1");
    assert.deepStrictEqual(calls, ["thread/start", "thread/resume"]);
    assert.strictEqual((await manager.resume("missing"))._unsafeUnwrapErr(), "missing_mapping");
  });
}
