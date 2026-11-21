import * as assert from "node:assert";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { stopCodexAppServer } from "../../src/codexStop";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "reports a rejected termination signal",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Verify Codex process shutdown." }]
  }
};
export function registerStopFailureCase(): void {
    test(TEST_CASE_METADATA.title, async () => {
        const child: ChildProcess = new EventEmitter() as ChildProcess;
        child.kill = () => false;
        assert.strictEqual(await stopCodexAppServer(child), false);
    });
}


