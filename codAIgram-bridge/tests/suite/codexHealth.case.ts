import * as assert from "node:assert";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { CodexProcessHealth } from "../../src/codexHealth";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "reports unexpected Codex termination once and suppresses intentional shutdown",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Detect Codex process health failures without reporting intentional shutdown." }]
  }
};

export function registerCodexHealthCase(): void {
  test(TEST_CASE_METADATA.title, () => {
    const child: ChildProcess = new EventEmitter() as ChildProcess;
    const events: string[] = [];
    const health: CodexProcessHealth = new CodexProcessHealth(child, (event) => { events.push(event); });
    child.emit("exit", 1);
    child.emit("close", 1);
    assert.deepStrictEqual(events, ["unexpected_exit"]);
    health.dispose();
    const intentionalChild: ChildProcess = new EventEmitter() as ChildProcess;
    const intentionalEvents: string[] = [];
    const intentional: CodexProcessHealth = new CodexProcessHealth(intentionalChild, (event) => { intentionalEvents.push(event); });
    intentional.markIntentionalShutdown();
    intentionalChild.emit("exit", 0);
    assert.deepStrictEqual(intentionalEvents, []);
    intentional.dispose();
  });
}
