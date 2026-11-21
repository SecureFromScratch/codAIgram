import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as path from "node:path";
import { createCodexLaunchSpec } from "../../src/codexLaunchSpec";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "builds a fixed read-only stdio Codex launch specification",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Specify a native Codex app server launch with read-only sandbox and approval on request." }]
  }
};

export function registerCodexLaunchSpecCase(): void {
    test(TEST_CASE_METADATA.title, () => {
        const executable: string = path.resolve("fixture path", "codex");
        const cwd: string = path.resolve("workspace path");
        assert.deepStrictEqual(createCodexLaunchSpec({ path: executable, kind: "native" }, cwd)._unsafeUnwrap(), {
          command: executable,
          args: ["app-server", "--listen", "stdio://", "-c", 'sandbox_mode="read-only"', "-c", 'approval_policy="on-request"'],
          cwd
        });
        assert.strictEqual(createCodexLaunchSpec({ path: executable, kind: "command_script" }, cwd)._unsafeUnwrapErr(), "unsupported_launcher");
        assert.strictEqual(createCodexLaunchSpec({ path: "codex", kind: "native" }, cwd)._unsafeUnwrapErr(), "invalid_executable_path");
        assert.strictEqual(createCodexLaunchSpec({ path: executable, kind: "native" }, "relative")._unsafeUnwrapErr(), "invalid_working_directory");
        assert.strictEqual(createCodexLaunchSpec({ path: `${executable}\0`, kind: "native" }, cwd)._unsafeUnwrapErr(), "invalid_executable_path");
        assert.strictEqual(createCodexLaunchSpec({ path: executable, kind: "native" }, `${cwd}\0`)._unsafeUnwrapErr(), "invalid_working_directory");
    });
}
