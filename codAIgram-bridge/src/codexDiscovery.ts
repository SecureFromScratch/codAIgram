import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Stats } from "node:fs";
import { err, ok, Result, ResultAsync } from "neverthrow";

export interface CodexExecutable {
    readonly path: string;
    readonly kind: "native" | "command_script";
}
export type CodexDiscoveryErrorT = "invalid_path" | "not_found";
export type DiscoveryPlatformT = "windows" | "posix";
export type ExecutableProbeT = (candidate: string, requireExecutePermission: boolean) => Promise<boolean>;

export async function probeExecutable(candidate: string, requireExecutePermission: boolean): Promise<boolean> {
    const status: Result<Stats, string> = await ResultAsync.fromPromise(fs.stat(candidate), () => "not a file");
    if (status.isErr() || !status.value.isFile()) return false;
    if (!requireExecutePermission) return true;
    const access: Result<void, string> = await ResultAsync.fromPromise(fs.access(candidate, fs.constants.X_OK), () => "not executable");
    return access.isOk();
}

export async function discoverCodexInPath(pathValue: string, platform: DiscoveryPlatformT, pathExtensions: string, probe: ExecutableProbeT, additionalDirectories: readonly string[] = []): Promise<Result<CodexExecutable, CodexDiscoveryErrorT>> {
    const windows: boolean = platform === "windows";
    const directories: string[] = [...pathValue.split(windows ? ";" : ":"), ...additionalDirectories].filter((directory) => windows
        ? /^(?:[a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/u.test(directory)
        : path.posix.isAbsolute(directory));
    if (directories.length === 0) return err("invalid_path");
    const extensions: string[] = windows ? (pathExtensions || ".EXE;.COM;.CMD;.BAT").split(";").map((extension) => extension.toUpperCase()).filter((extension) => [".EXE", ".COM", ".CMD", ".BAT"].includes(extension)) : [""];
    for (let index: number = 0; index < directories.length; index += 1) {
        for (let suffixIndex: number = 0; suffixIndex < extensions.length; suffixIndex += 1) {
            const extension: string = extensions[suffixIndex];
            const candidate: string = (windows ? path.win32 : path.posix).join(directories[index], `codex${extension}`);
            if (await probe(candidate, !windows)) {
                const kind: CodexExecutable["kind"] = extension === ".CMD" || extension === ".BAT" ? "command_script" : "native";
                return ok({ path: candidate, kind });
            }
        }
    }
    return err("not_found");
}

export async function discoverCodexExecutable(additionalDirectories: readonly string[] = []): Promise<Result<CodexExecutable, CodexDiscoveryErrorT>> {
    const platform: DiscoveryPlatformT = process.platform === "win32" ? "windows" : "posix";
    return discoverCodexInPath(process.env.PATH ?? "", platform, process.env.PATHEXT ?? "", probeExecutable, additionalDirectories);
}
