import { spawn } from "node:child_process";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { err, ok, Result } from "neverthrow";
import type { CodexExecutable } from "./codexDiscovery";
import { createCodexLaunchSpec } from "./codexLaunchSpec";
import type { CodexLaunchSpec, CodexLaunchSpecErrorT } from "./codexLaunchSpec";

export type CodexSpawnErrorT = CodexLaunchSpecErrorT | "spawn_failed";
export type CodexSpawnerT = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

const defaultSpawner: CodexSpawnerT = (command, args, options) => spawn(command, args, options);

export async function spawnCodexAppServer(executable: CodexExecutable, cwd: string, spawner: CodexSpawnerT = defaultSpawner): Promise<Result<ChildProcess, CodexSpawnErrorT>> {
    const spec: Result<CodexLaunchSpec, CodexLaunchSpecErrorT> = createCodexLaunchSpec(executable, cwd);
    if (spec.isErr()) return err(spec.error);
    const options: SpawnOptions = { cwd: spec.value.cwd, shell: false, stdio: "pipe" };
    const mapSpawnError: () => CodexSpawnErrorT = () => "spawn_failed";
    const creation: Result<ChildProcess, CodexSpawnErrorT> = Result.fromThrowable(() => spawner(spec.value.command, spec.value.args, options), mapSpawnError)();
    if (creation.isErr()) return err(creation.error);
    const child: ChildProcess = creation.value;
    return new Promise((resolve) => {
        let started: boolean = false;
        const onError: (error: Error) => void = () => {
            if (started) {
                console.error("Codex App Server process error.");
                return;
            }
            child.removeListener("spawn", onSpawn);
            resolve(err("spawn_failed"));
        };
        const onSpawn: () => void = () => {
            started = true;
            resolve(ok(child));
        };
        child.on("error", onError);
        child.once("spawn", onSpawn);
        child.once("close", () => child.removeListener("error", onError));
    });
}
