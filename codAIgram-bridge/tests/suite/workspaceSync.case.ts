import * as assert from "node:assert";
import { isChatPromptRequest, validateWorkspaceRequest } from "@codaigram/bridge-protocol";
import type { WorkspaceSyncRequest } from "@codaigram/bridge-protocol";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "validates workspace sync timestamps without weakening request shape checks",
  prompt: {
    availability: "available",
    history: [
      { when: "2026-11-19", text: "Carry a workspace sync timestamp through strict request validation." },
      { when: "2026/11/23 09:35", text: "Require chat requests to include cwd and workFolders, and update valid and invalid request cases accordingly." }
    ]
  }
};

export function registerWorkspaceSyncCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const synchronizedChat: object = {
      version: 1,
      type: "chat",
      id: "one",
      syncTimestamp: 5,
      prompt: "Inspect the project",
      cwd: "C:\\workspace",
      workFolders: []
    };
    const validatedChat: WorkspaceSyncRequest = (await validateWorkspaceRequest(JSON.stringify(synchronizedChat)))._unsafeUnwrap();
    assert.ok(isChatPromptRequest(validatedChat));
    assert.deepStrictEqual(validatedChat, {
      type: "chat",
      id: "one",
      syncTimestamp: 5,
      prompt: "Inspect the project",
      cwd: "C:\\workspace",
      workFolders: []
    });
    const promptedChat: object = {
      version: 1,
      type: "chat",
      id: "prompt",
      prompt: "Inspect the project",
      syncTimestamp: 5,
      cwd: "C:\\workspace",
      workFolders: []
    };
    const promptedExpected: object = {
      type: "chat",
      id: "prompt",
      prompt: "Inspect the project",
      syncTimestamp: 5,
      cwd: "C:\\workspace",
      workFolders: []
    };
    assert.deepStrictEqual((await validateWorkspaceRequest(JSON.stringify(promptedChat)))._unsafeUnwrap(), promptedExpected);
    const invalidPromptPing: object = {
      version: 1,
      type: "ping",
      id: "ping",
      prompt: "not allowed"
    };
    const missingCwdRequest: object = {
      version: 1,
      type: "chat",
      id: "missing-cwd",
      prompt: "Inspect",
      workFolders: [],
      syncTimestamp: 5
    };
    const missingWorkFoldersRequest: object = {
      version: 1,
      type: "chat",
      id: "missing-work-folders",
      prompt: "Inspect",
      cwd: "C:\\workspace",
      syncTimestamp: 5
    };
    const missingPromptRequest: object = {
      version: 1,
      type: "chat",
      id: "missing-prompt",
      cwd: "C:\\workspace",
      workFolders: [],
      syncTimestamp: 5
    };
    const emptyWorkFolderRequest: object = {
      version: 1,
      type: "chat",
      id: "empty-work-folder",
      prompt: "Inspect",
      cwd: "C:\\workspace",
      workFolders: [""],
      syncTimestamp: 5
    };
    const emptyCwdRequest: object = {
      version: 1,
      type: "chat",
      id: "empty-cwd",
      prompt: "Inspect",
      cwd: "",
      workFolders: [],
      syncTimestamp: 5
    };
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify(invalidPromptPing)))._unsafeUnwrapErr(), "Invalid request");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify({ version: 1, type: "chat", id: "one", extra: true })))._unsafeUnwrapErr(), "Invalid request");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify(missingCwdRequest)))._unsafeUnwrapErr(), "Invalid cwd");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify(missingWorkFoldersRequest)))._unsafeUnwrapErr(), "Invalid work folders");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify(missingPromptRequest)))._unsafeUnwrapErr(), "Invalid prompt");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify(emptyWorkFolderRequest)))._unsafeUnwrapErr(), "Invalid work folders");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify({ version: 1, type: "chat", id: "one", syncTimestamp: -1, prompt: "Inspect", cwd: "C:\\workspace", workFolders: [] })))._unsafeUnwrapErr(), "Invalid sync timestamp");
    assert.strictEqual((await validateWorkspaceRequest(JSON.stringify(emptyCwdRequest)))._unsafeUnwrapErr(), "Invalid cwd");
    const scanRequest: object = {
      version: 1,
      type: "scan/tests",
      id: "scan",
      workFolders: ["C:\\workspace"]
    };
    const scanExpected: object = {
      type: "scan/tests",
      id: "scan",
      workFolders: ["C:\\workspace"],
      scanType: "tests"
    };
    assert.deepStrictEqual((await validateWorkspaceRequest(JSON.stringify(scanRequest)))._unsafeUnwrap(), scanExpected);
    const codeRequest: object = {
      version: 1,
      type: "code/get",
      id: "code",
      projectName: "mock-project",
      workFolders: ["C:\\workspace"],
      filepath: "src/model.ts",
      typeName: "Widget"
    };
    const codeExpected: object = {
      type: "code/get",
      id: "code",
      projectName: "mock-project",
      workFolders: ["C:\\workspace"],
      filepath: "src/model.ts",
      typeName: "Widget"
    };
    assert.deepStrictEqual((await validateWorkspaceRequest(JSON.stringify(codeRequest)))._unsafeUnwrap(), codeExpected);
  });
}
