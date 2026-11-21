import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { validateWorkingDirectory } from "../../src/workingDirectory";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "authorizes canonical directories within the workspace",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Validate workspace working directories and reject traversal and symlink escapes." }]
  }
};

export function registerWorkingDirectoryCase(): void {
    test(TEST_CASE_METADATA.title, async () => {
        const temporaryRoot: string = await fs.mkdtemp(path.resolve(__dirname, "../../../working-directory-test-"));
        try {
            const root: string = path.join(temporaryRoot, "workspace");
            const child: string = path.join(root, "child");
            const outside: string = path.join(temporaryRoot, "workspace-other");
            const file: string = path.join(root, "file.txt");
            const escape: string = path.join(root, "escape");
            const insideLink: string = path.join(root, "inside-link");
            await fs.mkdir(child, { recursive: true });
            await fs.mkdir(outside);
            await fs.writeFile(file, "test");
            let symlinksAvailable: boolean = true;
            try {
                await fs.symlink(outside, escape, "dir");
                await fs.symlink(child, insideLink, "dir");
            } catch (error: unknown) {
                console.warn("Symlink creation unavailable for this test host.", error);
                const code: string | undefined = (error as { code?: string }).code;
                if (code !== "EPERM" && code !== "EACCES") {
                    assert.fail(`Unexpected symlink creation failure: ${String(error)}`);
                }
                symlinksAvailable = false;
            }
            assert.strictEqual((await validateWorkingDirectory(root, root))._unsafeUnwrap(), await fs.realpath(root));
            assert.strictEqual((await validateWorkingDirectory(root, child))._unsafeUnwrap(), await fs.realpath(child));
            if (symlinksAvailable) {
                assert.strictEqual((await validateWorkingDirectory(root, insideLink))._unsafeUnwrap(), await fs.realpath(child));
            }
            assert.strictEqual((await validateWorkingDirectory(root, outside))._unsafeUnwrapErr(), "outside_workspace");
            assert.strictEqual((await validateWorkingDirectory(root, path.join(root, "..", "workspace-other")))._unsafeUnwrapErr(), "outside_workspace");
            if (symlinksAvailable) {
                assert.strictEqual((await validateWorkingDirectory(root, escape))._unsafeUnwrapErr(), "outside_workspace");
            }
            assert.strictEqual((await validateWorkingDirectory(root, file))._unsafeUnwrapErr(), "invalid_candidate");
            assert.strictEqual((await validateWorkingDirectory(root, path.join(root, "missing")))._unsafeUnwrapErr(), "invalid_candidate");
            assert.strictEqual((await validateWorkingDirectory(root, "relative"))._unsafeUnwrapErr(), "invalid_candidate");
            assert.strictEqual((await validateWorkingDirectory(file, child))._unsafeUnwrapErr(), "invalid_workspace_root");
        } finally {
            await fs.rm(temporaryRoot, { recursive: true, force: true });
        }
    });
}
