import * as assert from "node:assert";
import type { RawData } from "ws";
import { connectWebSocket, closeWebSocket } from "./extension.helpers";
import type { ConnectedWebSocket } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";
import type { BridgeApi } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "returns workspace folders and blocks stale chat requests",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Expose workspace folders and require a current synchronization timestamp before chat." }]
  }
};

function nextMessage(connection: ConnectedWebSocket): Promise<string> {
  return new Promise((resolve) => connection.socket.once("message", (data: RawData) => resolve(data.toString())));
}

interface WorkspaceFoldersResponse {
  readonly version: number;
  readonly type: string;
  readonly id: string;
  readonly syncTimestamp: number;
  readonly folders: readonly unknown[];
}

export function registerWorkspaceSyncIntegrationCase(getApi: () => BridgeApi): void {
  test(TEST_CASE_METADATA.title, async () => {
    const api: BridgeApi = getApi();
    const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
    try {
      assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
      connection.socket.send(JSON.stringify({ version: 1, type: "workspace_folders", id: "folders" }));
      const folders: WorkspaceFoldersResponse = JSON.parse(await nextMessage(connection)) as WorkspaceFoldersResponse;
      assert.strictEqual(folders.version, 1);
      assert.strictEqual(folders.type, "workspace_folders");
      assert.strictEqual(folders.id, "folders");
      assert.ok(Number.isSafeInteger(folders.syncTimestamp));
      assert.ok(Array.isArray(folders.folders));
      connection.socket.send(JSON.stringify({
        version: 1,
        type: "chat",
        id: "chat",
        syncTimestamp: 0,
        prompt: "Inspect the project",
        cwd: "C:\\workspace",
        workFolders: [],
        projectName: "mock-project",
        relatedFile: "",
        relatedClass: "",
        relatedMember: ""
      }));
      assert.deepStrictEqual(JSON.parse(await nextMessage(connection)), {
        version: 1,
        type: "error",
        id: "chat",
        code: "workspace_sync_required",
        syncTimestamp: folders.syncTimestamp,
        required: ["workspace_folders"]
      });
      const minimalChatRequest: object = {
        version: 1,
        type: "chat",
        id: "chat-minimal",
        syncTimestamp: 0,
        prompt: "Inspect the project",
        cwd: "C:\\workspace",
        workFolders: [],
        projectName: "mock-project",
        relatedFile: "",
        relatedClass: "",
        relatedMember: ""
      };
      connection.socket.send(JSON.stringify(minimalChatRequest));
      assert.deepStrictEqual(JSON.parse(await nextMessage(connection)), {
        version: 1,
        type: "error",
        id: "chat-minimal",
        code: "workspace_sync_required",
        syncTimestamp: folders.syncTimestamp,
        required: ["workspace_folders"]
      });
    } finally {
      await closeWebSocket(connection.socket);
    }
  });
}
