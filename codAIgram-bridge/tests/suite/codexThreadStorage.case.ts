import * as assert from "node:assert";
import { createCodexThreadMappingStore } from "../../src/codexThreadStorage";
import type { CodexThreadMappingStoreT } from "../../src/codexThreads";
import type * as vscode from "vscode";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "persists Codex thread mappings in extension state",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Persist conversation-to-thread mappings across extension activation." }]
  }
};

export function registerCodexThreadStorageCase(): void {
  test(TEST_CASE_METADATA.title, () => {
    const values: Map<string, unknown> = new Map<string, unknown>();
    const get: vscode.Memento["get"] = ((key: string, fallback: unknown) => values.has(key) ? values.get(key) : fallback) as vscode.Memento["get"];
    const update: (key: string, value: unknown) => Thenable<void> = async (key, value) => { values.set(key, value); };
    const state: vscode.Memento = { get, update, keys: () => [...values.keys()] };
    const store: CodexThreadMappingStoreT = createCodexThreadMappingStore(state);
    const missing: string | undefined = values.get("missing") as string | undefined;
    assert.strictEqual(store.read("conversation"), missing);
    store.write("conversation", "thread");
    assert.strictEqual(store.read("conversation"), "thread");
  });
}
