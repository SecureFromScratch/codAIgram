import * as vscode from "vscode";
import { err, ok, Result } from "neverthrow";
import type { WorkspaceFoldersT } from "./workspaceFolders";

export type WorkspaceRootErrorT = "no_workspace" | "ambiguous_workspace" | "unsupported_workspace_uri";

export function resolveWorkspaceFolders(folders: readonly Pick<vscode.WorkspaceFolder, "uri">[]): Result<string, WorkspaceRootErrorT> {
    if (folders.length === 0) return err("no_workspace");
    if (folders.length !== 1) return err("ambiguous_workspace");
    if (folders[0].uri.scheme !== "file") return err("unsupported_workspace_uri");
    return ok(folders[0].uri.fsPath);
}

export function resolveWorkspaceFolderRoots(folders: readonly Pick<vscode.WorkspaceFolder, "uri">[]): Result<readonly string[], WorkspaceRootErrorT> {
    if (folders.length === 0) return err("no_workspace");
    if (folders.some((folder) => folder.uri.scheme !== "file")) return err("unsupported_workspace_uri");
    return ok(folders.map((folder) => folder.uri.fsPath));
}

export function resolveWorkspaceRoot(): Result<string, WorkspaceRootErrorT> {
    const folders: WorkspaceFoldersT = vscode.workspace.workspaceFolders;
    if (!folders) return err("no_workspace");
    return resolveWorkspaceFolders(folders);
}
