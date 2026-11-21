import * as assert from "node:assert";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { startCodexAppServer } from "../../src/codexLifecycle";
import type { CodexSpawnerT } from "../../src/codexSpawn";
import type { CodexExecutable } from "../../src/codexDiscovery";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "starts Codex only after protocol initialization",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Compose Codex spawn with JSONL initialization and clean up failed handshakes." }]
  }
};

export function registerCodexLifecycleCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const child: ChildProcess = new EventEmitter() as ChildProcess;
    const stdin: PassThrough = new PassThrough();
    const stdout: PassThrough = new PassThrough();
    child.stdin = stdin;
    child.stdout = stdout;
    child.kill = () => true;
    const spawner: CodexSpawnerT = () => child;
    const executable: CodexExecutable = { path: "C:\\codex.exe", kind: "native" };
    const pending: ReturnType<typeof startCodexAppServer> = startCodexAppServer(executable, "C:\\workspace", { name: "bridge", title: "Bridge", version: "1" }, spawner);
    await Promise.resolve();
    child.emit("spawn");
    await Promise.resolve();
    stdout.write('{"id":1,"result":{}}\n');
    assert.strictEqual((await pending)._unsafeUnwrap(), child);
  });
}
