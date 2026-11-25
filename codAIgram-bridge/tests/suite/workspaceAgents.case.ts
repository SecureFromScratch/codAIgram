import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { configuredAgentsForWorkspaceFolder } from "../../src/extension";
import type { BridgeApi } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "reports configured coding agents for workspace folders",
  prompt: {
    availability: "unavailable",
    reason: "Workspace agent configuration metadata does not require a prompt.",
    history: []
  }
};

export function registerWorkspaceAgentsCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const temporaryRoot: string | undefined = process.env.CODAIGRAM_BRIDGE_TEMP_DIRECTORY;
        assert.ok(temporaryRoot, "The integration runner must provide its temporary directory.");
        const temporaryFolder: string = await fs.mkdtemp(path.join(temporaryRoot, "agents-"));
        try {
            await Promise.all([
                fs.writeFile(path.join(temporaryFolder, "AGENTS.md"), "codex", "utf8"),
                fs.writeFile(path.join(temporaryFolder, "CLAUDE.md"), "claude", "utf8"),
                fs.writeFile(path.join(temporaryFolder, "AGENT.md"), "grok", "utf8")
            ]);
            assert.deepStrictEqual(configuredAgentsForWorkspaceFolder({ uri: vscode.Uri.file(temporaryFolder) }), ["codex", "claude", "grok"]);
            getApi().getWorkspaceFolders().forEach((folder) => assert.ok(Array.isArray(folder.configuredAgents)));
        } finally {
            await fs.rm(temporaryFolder, { recursive: true, force: true });
        }
    });
}
