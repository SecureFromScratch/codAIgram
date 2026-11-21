import * as assert from "node:assert";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { stopCodexAppServer } from "../../src/codexStop";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "waits for termination and shares concurrent shutdown",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Verify Codex process shutdown." }]
  }
};
export function registerStopCase(): void {
    test(TEST_CASE_METADATA.title, async () => {
        const child: ChildProcess = new EventEmitter() as ChildProcess;
        let kills: number = 0;
        child.kill = () => { kills += 1; return true; };
        const first: Promise<boolean> = stopCodexAppServer(child);
        const second: Promise<boolean> = stopCodexAppServer(child);
        let settled: boolean = false;
        void first.then(() => { settled = true; });
        await Promise.resolve();
        assert.strictEqual(settled, false);
        assert.strictEqual(kills, 1);
        child.emit("exit", 0);
        assert.strictEqual(await first, true);
        assert.strictEqual(await second, true);
        assert.strictEqual(await stopCodexAppServer(child), true);
        assert.strictEqual(kills, 1);
    });
}


