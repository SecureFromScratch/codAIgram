import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { spawnCodexAppServer } from "../../src/codexSpawn";
import type { CodexSpawnerT } from "../../src/codexSpawn";
import type { CodexExecutable } from "../../src/codexDiscovery";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "spawns the fixed Codex specification and reports startup failures",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Spawn a fixed Codex app server spec with explicit cwd and piped stdio; report spawn failures." }]
  }
};

export function registerCodexSpawnCase(): void {
    test(TEST_CASE_METADATA.title, async () => {
        const executable: CodexExecutable = { path: path.resolve("codex"), kind: "native" };
        const cwd: string = path.resolve("workspace");
        const child: ChildProcess = new EventEmitter() as ChildProcess;
        let called: boolean = false;
        const spawner: CodexSpawnerT = (command, args, options) => {
            called = true;
            assert.strictEqual(command, executable.path);
            assert.deepStrictEqual(args, ["app-server", "--listen", "stdio://", "-c", 'sandbox_mode="read-only"', "-c", 'approval_policy="on-request"']);
            assert.deepStrictEqual(options, { cwd, shell: false, stdio: "pipe" });
            return child;
        };
        const pending: ReturnType<typeof spawnCodexAppServer> = spawnCodexAppServer(executable, cwd, spawner);
        let settled: boolean = false;
        void pending.then(() => { settled = true; });
        await Promise.resolve();
        assert.strictEqual(settled, false);
        child.emit("spawn");
        const success: Awaited<ReturnType<typeof spawnCodexAppServer>> = await pending;
        assert.ok(called);
        assert.strictEqual(success._unsafeUnwrap(), child);
        const syncFailure: CodexSpawnerT = () => JSON.parse("{") as ChildProcess;
        assert.strictEqual((await spawnCodexAppServer(executable, cwd, syncFailure))._unsafeUnwrapErr(), "spawn_failed");
        const asyncFailure: CodexSpawnerT = () => {
            const failing: ChildProcess = new EventEmitter() as ChildProcess;
            process.nextTick(() => failing.emit("error", new Error("asynchronous spawn failure")));
            return failing;
        };
        assert.strictEqual((await spawnCodexAppServer(executable, cwd, asyncFailure))._unsafeUnwrapErr(), "spawn_failed");
        called = false;
        assert.strictEqual((await spawnCodexAppServer({ path: executable.path, kind: "command_script" }, cwd, spawner))._unsafeUnwrapErr(), "unsupported_launcher");
        assert.strictEqual(called, false);
    });
}
