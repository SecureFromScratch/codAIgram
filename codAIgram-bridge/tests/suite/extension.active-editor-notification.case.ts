import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as vscode from "vscode";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "notifies an authenticated client of active editor presence changes",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Send unsolicited active editor presence notifications and clean up listeners at disconnect." }]
  }
};

function nextNotification(connection: ConnectedWebSocket): Promise<string> {
    return new Promise((resolve, reject) => {
        const timeout: NodeJS.Timeout = setTimeout(() => reject(new Error("Timed out waiting for editor notification.")), 3_000);
        connection.socket.addEventListener("message", (event) => {
            clearTimeout(timeout);
            resolve(String(event.data));
        }, { once: true });
    });
}

export function registerActiveEditorNotificationCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        await vscode.commands.executeCommand("workbench.action.closeAllEditors");
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const opened: Promise<string> = nextNotification(connection);
            const document: vscode.TextDocument = await vscode.workspace.openTextDocument({ language: "plaintext" });
            await vscode.window.showTextDocument(document);
            assert.deepStrictEqual(JSON.parse(await opened), {
              version: 1,
              type: "active_editor_changed",
              hasActiveEditor: true
            });
            const closed: Promise<string> = nextNotification(connection);
            await vscode.commands.executeCommand("workbench.action.closeAllEditors");
            assert.deepStrictEqual(JSON.parse(await closed), {
              version: 1,
              type: "active_editor_changed",
              hasActiveEditor: false
            });
        } finally {
            await closeWebSocket(connection.socket);
            await vscode.commands.executeCommand("workbench.action.closeAllEditors");
        }
    });
}
