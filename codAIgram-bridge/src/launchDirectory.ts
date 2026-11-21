import { err, Result } from "neverthrow";
import type { WorkspaceRootErrorT } from "./workspaceRoot";
import { resolveWorkspaceRoot } from "./workspaceRoot";
import type { WorkingDirectoryErrorT } from "./workingDirectory";
import { validateWorkingDirectory } from "./workingDirectory";

export type LaunchDirectoryErrorT = WorkspaceRootErrorT | WorkingDirectoryErrorT;

export async function resolveLaunchDirectoryFrom(root: Result<string, WorkspaceRootErrorT>): Promise<Result<string, LaunchDirectoryErrorT>> {
    if (root.isErr()) return err(root.error);
    return validateWorkingDirectory(root.value, root.value);
}

export async function resolveLaunchDirectory(): Promise<Result<string, LaunchDirectoryErrorT>> {
    return resolveLaunchDirectoryFrom(resolveWorkspaceRoot());
}
