import * as path from "node:path";
import { err, ok, Result } from "neverthrow";
import type { CodexExecutable } from "./codexDiscovery";

export interface CodexLaunchSpec {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
}
export type CodexLaunchSpecErrorT = "unsupported_launcher" | "invalid_executable_path" | "invalid_working_directory";

export function createCodexLaunchSpec(executable: CodexExecutable, cwd: string): Result<CodexLaunchSpec, CodexLaunchSpecErrorT> {
    if (executable.kind !== "native") return err("unsupported_launcher");
    if (!path.isAbsolute(executable.path) || executable.path.includes("\0")) return err("invalid_executable_path");
    if (!path.isAbsolute(cwd) || cwd.includes("\0")) return err("invalid_working_directory");
    return ok({
      command: executable.path,
      args: ["app-server", "--listen", "stdio://", "-c", 'sandbox_mode="read-only"', "-c", 'approval_policy="on-request"'],
      cwd
    });
}
