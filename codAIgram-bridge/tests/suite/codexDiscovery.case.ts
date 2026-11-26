import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Stats } from "node:fs";
import { discoverCodexExecutable, discoverCodexInPath, probeExecutable } from "../../src/codexDiscovery";
import type { DiscoveryPlatformT, ExecutableProbeT } from "../../src/codexDiscovery";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "discovers a usable Codex executable without invoking it",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Discover Codex from PATH with portable executable and launcher handling." }]
  }
};

export function registerCodexDiscoveryCase(): void {
    test(TEST_CASE_METADATA.title, async () => {
        const temporaryRoot: string = await fs.mkdtemp(path.resolve(__dirname, "../../../codex-discovery-test-"));
        try {
            const first: string = path.join(temporaryRoot, "first");
            const second: string = path.join(temporaryRoot, "second");
            const windows: boolean = process.platform === "win32";
            const executable: string = path.join(second, windows ? "codex.EXE" : "codex");
            await fs.mkdir(first);
            await fs.mkdir(second);
            await fs.mkdir(path.join(first, windows ? "codex.EXE" : "codex"));
            await fs.writeFile(executable, "executable fixture", { mode: 0o755 });
            const platform: DiscoveryPlatformT = windows ? "windows" : "posix";
            assert.deepStrictEqual((await discoverCodexInPath([first, second].join(path.delimiter), platform, ".EXE", probeExecutable))._unsafeUnwrap(), { path: executable, kind: "native" });
            assert.strictEqual((await discoverCodexInPath("relative::.", "posix", "", probeExecutable))._unsafeUnwrapErr(), "invalid_path");
            assert.strictEqual((await discoverCodexInPath(first, platform, ".EXE", probeExecutable))._unsafeUnwrapErr(), "not_found");
            assert.deepStrictEqual(
              (await discoverCodexInPath(first, platform, windows ? ".EXE" : "", probeExecutable, [second]))._unsafeUnwrap(),
              { path: executable, kind: "native" }
            );
            const orderedProbe: ExecutableProbeT = async (candidate) => candidate === executable;
            assert.deepStrictEqual((await discoverCodexInPath([first, second].join(path.delimiter), platform, ".EXE", orderedProbe))._unsafeUnwrap(), { path: executable, kind: "native" });
            if (!windows) {
                const nonExecutable: string = path.join(temporaryRoot, "non-executable");
                await fs.writeFile(nonExecutable, "fixture", { mode: 0o644 });
                const status: Stats = await fs.stat(nonExecutable);
                if ((status.mode & 0o111) === 0) assert.strictEqual(await probeExecutable(nonExecutable, true), false);
            }
            const windowsProbe: ExecutableProbeT = async (candidate) => candidate.toLowerCase() === "c:\\tools\\codex.cmd";
            assert.deepStrictEqual((await discoverCodexInPath(".;C:\\tools", "windows", ".EXE;.CMD;.BAT", windowsProbe))._unsafeUnwrap(), { path: "C:\\tools\\codex.CMD", kind: "command_script" });
            const actual: Awaited<ReturnType<typeof discoverCodexExecutable>> = await discoverCodexExecutable();
            if (actual.isOk()) assert.ok(await probeExecutable(actual.value.path, !windows));
        } finally {
            await fs.rm(temporaryRoot, { recursive: true, force: true });
        }
    });
}
