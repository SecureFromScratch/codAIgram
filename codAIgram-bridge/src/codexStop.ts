import type { ChildProcess } from "node:child_process";
import { Result } from "neverthrow";

const stops: WeakMap<ChildProcess, Promise<boolean>> = new WeakMap();

export function stopCodexAppServer(child: ChildProcess): Promise<boolean> {
    const existing: Promise<boolean> | undefined = stops.get(child);
    if (existing) return existing;
    if (typeof child.exitCode === "number" || typeof child.signalCode === "string") return Promise.resolve(true);
    let finish!: (success: boolean) => void;
    const pending: Promise<boolean> = new Promise((resolve) => { finish = resolve; });
    stops.set(child, pending);
    const onExit: () => void = () => finish(true);
    child.once("exit", onExit);
    const signal: Result<boolean, unknown> = Result.fromThrowable(() => child.kill())();
    if (signal.isErr() || !signal.value) {
        child.removeListener("exit", onExit);
        stops.delete(child);
        finish(false);
    }
    return pending;
}
