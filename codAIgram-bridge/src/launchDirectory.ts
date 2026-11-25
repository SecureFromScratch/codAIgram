import { err, Result } from "neverthrow";
import type { WorkspaceRootErrorT } from "./workspaceRoot";
import { resolveWorkspaceFolderRoots, resolveWorkspaceRoot } from "./workspaceRoot";
import type { WorkingDirectoryErrorT } from "./workingDirectory";
import { validateWorkingDirectory } from "./workingDirectory";
import * as vscode from "vscode";

type WorkspaceFoldersT = typeof vscode.workspace.workspaceFolders;

export type LaunchDirectoryErrorT = WorkspaceRootErrorT | WorkingDirectoryErrorT;

export async function resolveLaunchDirectoryFrom(root: Result<string, WorkspaceRootErrorT>): Promise<Result<string, LaunchDirectoryErrorT>> {
    if (root.isErr()) return err(root.error);
    return validateWorkingDirectory(root.value, root.value);
}

export async function resolveLaunchDirectory(): Promise<Result<string, LaunchDirectoryErrorT>> {
    return resolveLaunchDirectoryFrom(resolveWorkspaceRoot());
}

export async function resolveLaunchDirectoryFor(candidate: string): Promise<Result<string, LaunchDirectoryErrorT>> {
    const folders: WorkspaceFoldersT = vscode.workspace.workspaceFolders;
    const roots: Result<readonly string[], WorkspaceRootErrorT> = resolveWorkspaceFolderRoots(folders ? folders : []);
    return resolveLaunchDirectoryForFrom(roots, candidate);
}

export async function resolveLaunchDirectoryForFrom(roots: Result<readonly string[], WorkspaceRootErrorT>, candidate: string): Promise<Result<string, LaunchDirectoryErrorT>> {
    if (roots.isErr()) return err(roots.error);
    let validRootCount: number = 0;
    for (let rootIndex: number = 0; rootIndex < roots.value.length; rootIndex++) {
        const root: string = roots.value[rootIndex] as string;
        const validation: Awaited<ReturnType<typeof validateWorkingDirectory>> = await validateWorkingDirectory(root, candidate);
        if (validation.isOk()) return validation;
        if (validation.error === "invalid_candidate") return err(validation.error);
        if (validation.error === "invalid_workspace_root") continue;
        validRootCount++;
    }
    return err(validRootCount === 0 ? "invalid_workspace_root" : "outside_workspace");
}
