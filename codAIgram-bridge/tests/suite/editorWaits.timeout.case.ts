import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import { PendingEditorWaits } from "@codaigram/bridge-protocol";
import type { WaitTimer, WaitTimerSchedulerT } from "@codaigram/bridge-protocol";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "expires waits and cancels their timers on completion, cancellation and disposal",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Use a fixed server timeout with actual expiration, capacity reuse and timer cleanup." }]
  }
};

export function registerEditorWaitTimeoutCase(): void {
    test(TEST_CASE_METADATA.title, async () => {
        const expired: string[] = [];
        let resolveExpired: () => void = () => {};
        const allExpired: Promise<void> = new Promise((resolve) => { resolveExpired = resolve; });
        const shortTimer: WaitTimerSchedulerT = (callback, delayMs) => {
            assert.strictEqual(delayMs, 30_000);
            const timer: NodeJS.Timeout = setTimeout(callback, 20);
            const handle: WaitTimer = { dispose: () => clearTimeout(timer) };
            return handle;
        };
        const waits: PendingEditorWaits = new PendingEditorWaits((id) => {
            expired.push(id);
            if (expired.length === 32) resolveExpired();
        }, shortTimer);
        for (let index: number = 0; index < 32; index += 1) waits.add(`wait-${index}`);
        assert.strictEqual(waits.size, 32);
        await Promise.race([
            allExpired,
            new Promise<void>((_resolve, reject) => setTimeout(() => reject(new Error("Timeout callbacks did not fire.")), 1_000))
        ]);
        assert.strictEqual(waits.size, 0);
        assert.strictEqual(new Set(expired).size, 32);
        waits.add("wait-0");
        assert.strictEqual(waits.delete("wait-0"), true);
        waits.add("completed");
        assert.deepStrictEqual(waits.takeAll(), ["completed"]);
        waits.add("disconnected");
        waits.clear();
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
        assert.strictEqual(expired.length, 32);
        assert.strictEqual(waits.size, 0);
        const callbacks: Array<() => void> = [];
        const raceExpired: string[] = [];
        const queuedTimer: WaitTimerSchedulerT = (callback, delayMs) => {
            assert.strictEqual(delayMs, 30_000);
            callbacks.push(callback);
            return { dispose: () => {} };
        };
        const races: PendingEditorWaits = new PendingEditorWaits((id) => raceExpired.push(id), queuedTimer);
        races.add("reused");
        assert.strictEqual(races.delete("reused"), true);
        races.add("reused");
        callbacks[0]();
        assert.strictEqual(races.has("reused"), true);
        callbacks[1]();
        callbacks[1]();
        assert.deepStrictEqual(raceExpired, ["reused"]);
        assert.strictEqual(races.size, 0);
    });
}
