import type { ChildProcess } from "node:child_process";
import type { CodexExecutable } from "./codexDiscovery";
import { initializeCodexAppServer } from "./codexInitialize";
import type { CodexClientInfo, CodexInitializeErrorT } from "./codexInitialize";
import { spawnCodexAppServer } from "./codexSpawn";
import type { CodexSpawnerT, CodexSpawnErrorT } from "./codexSpawn";
import { stopCodexAppServer } from "./codexStop";
import { err, ok, Result } from "neverthrow";

export type CodexLifecycleErrorT = CodexSpawnErrorT | CodexInitializeErrorT | "missing_stream";

export async function startCodexAppServer(executable: CodexExecutable, cwd: string, clientInfo: CodexClientInfo, spawner?: CodexSpawnerT): Promise<Result<ChildProcess, CodexLifecycleErrorT>> {
  const spawned: Result<ChildProcess, CodexSpawnErrorT> = await spawnCodexAppServer(executable, cwd, spawner);
  if (spawned.isErr()) return err(spawned.error);
  const child: ChildProcess = spawned.value;
  if (!child.stdin || !child.stdout) {
    await stopCodexAppServer(child);
    return err("missing_stream");
  }
  const initialized: Result<unknown, CodexInitializeErrorT> = await initializeCodexAppServer(child.stdin, child.stdout, clientInfo);
  if (initialized.isErr()) {
    await stopCodexAppServer(child);
    return err(initialized.error);
  }
  return ok(child);
}
