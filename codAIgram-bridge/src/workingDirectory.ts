import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Stats } from "node:fs";
import { err, ok, Result, ResultAsync } from "neverthrow";

export type WorkingDirectoryErrorT = "invalid_workspace_root" | "invalid_candidate" | "outside_workspace";

async function canonicalDirectory(directory: string, error: WorkingDirectoryErrorT): Promise<Result<string, WorkingDirectoryErrorT>> {
    if (!path.isAbsolute(directory)) return err(error);
    const resolved: Result<string, WorkingDirectoryErrorT> = await ResultAsync.fromPromise(fs.realpath(directory), () => error);
    if (resolved.isErr()) return err(error);
    const status: Result<Stats, WorkingDirectoryErrorT> = await ResultAsync.fromPromise(fs.stat(resolved.value), () => error);
    if (status.isErr() || !status.value.isDirectory()) return err(error);
    return ok(resolved.value);
}

export async function validateWorkingDirectory(root: string, candidate: string): Promise<Result<string, WorkingDirectoryErrorT>> {
    const canonicalRoot: Result<string, WorkingDirectoryErrorT> = await canonicalDirectory(root, "invalid_workspace_root");
    if (canonicalRoot.isErr()) return err(canonicalRoot.error);
    const canonicalCandidate: Result<string, WorkingDirectoryErrorT> = await canonicalDirectory(candidate, "invalid_candidate");
    if (canonicalCandidate.isErr()) return err(canonicalCandidate.error);
    const relative: string = path.relative(canonicalRoot.value, canonicalCandidate.value);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return err("outside_workspace");
    return ok(canonicalCandidate.value);
}
