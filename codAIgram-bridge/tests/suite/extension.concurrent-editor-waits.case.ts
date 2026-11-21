import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as vscode from "vscode";
import type { RawData } from "ws";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "bounds concurrent editor waits and keeps pings responsive",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Support bounded correlated editor waits, duplicates and concurrent pings." }]
  }
};

function receive(connection: ConnectedWebSocket, count: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const messages: string[] = [];
        const timeout: NodeJS.Timeout = setTimeout(() => {
            connection.socket.removeListener("message", onMessage);
            reject(new Error("Timed out waiting for editor wait responses."));
        }, 3_000);
        const onMessage: (data: RawData) => void = (data) => {
            messages.push(data.toString());
            if (messages.length === count) {
                clearTimeout(timeout);
                connection.socket.removeListener("message", onMessage);
                resolve(messages);
            }
        };
        connection.socket.on("message", onMessage);
    });
}

export function registerConcurrentEditorWaitsCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        await vscode.commands.executeCommand("workbench.action.closeAllEditors");
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const immediate: Promise<string[]> = receive(connection, 2);
            for (let index: number = 0; index < 32; index += 1) {
                connection.socket.send(JSON.stringify({
                  version: 1,
                  type: "wait_for_active_editor_change",
                  id: `wait-${index}`
                }));
            }
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "wait_for_active_editor_change",
              id: "overflow"
            }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "check" }));
            assert.deepStrictEqual((await immediate).map((message) => JSON.parse(message)), [
                {
                  version: 1,
                  type: "error",
                  id: "overflow",
                  code: "too_many_pending_requests"
                },
                { version: 1, type: "pong", id: "check" }
            ]);
            const eventAndResponses: Promise<string[]> = receive(connection, 33);
            const document: vscode.TextDocument = await vscode.workspace.openTextDocument({ language: "plaintext" });
            await vscode.window.showTextDocument(document);
            const expected: unknown[] = [{
              version: 1,
              type: "active_editor_changed",
              hasActiveEditor: true
            }];
            for (let index: number = 0; index < 32; index += 1) {
                expected.push({
                  version: 1,
                  type: "active_editor_change",
                  id: `wait-${index}`,
                  hasActiveEditor: true
                });
            }
            assert.deepStrictEqual((await eventAndResponses).map((message) => JSON.parse(message)), expected);
            const oldToken: string = api.token;
            const firstBarrier: Promise<string[]> = receive(connection, 1);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "wait_for_active_editor_change",
              id: "reused"
            }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "before-close" }));
            assert.deepStrictEqual(JSON.parse((await firstBarrier)[0]), { version: 1, type: "pong", id: "before-close" });
            await closeWebSocket(connection.socket);
            await vscode.commands.executeCommand("workbench.action.closeAllEditors");
            for (let attempt: number = 0; attempt < 40 && api.token === oldToken; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            assert.notStrictEqual(api.token, oldToken);
            const reconnected: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
            try {
                assert.deepStrictEqual(JSON.parse(await reconnected.firstMessage), { version: 1, type: "welcome" });
                const secondBarrier: Promise<string[]> = receive(reconnected, 1);
                reconnected.socket.send(JSON.stringify({
                  version: 1,
                  type: "wait_for_active_editor_change",
                  id: "reused"
                }));
                reconnected.socket.send(JSON.stringify({ version: 1, type: "ping", id: "after-close" }));
                assert.deepStrictEqual(JSON.parse((await secondBarrier)[0]), { version: 1, type: "pong", id: "after-close" });
                const reconnectedResponses: Promise<string[]> = receive(reconnected, 2);
                await vscode.window.showTextDocument(document);
                assert.deepStrictEqual((await reconnectedResponses).map((message) => JSON.parse(message)), [
                    {
                      version: 1,
                      type: "active_editor_changed",
                      hasActiveEditor: true
                    },
                    {
                      version: 1,
                      type: "active_editor_change",
                      id: "reused",
                      hasActiveEditor: true
                    }
                ]);
            } finally {
                await closeWebSocket(reconnected.socket);
            }
        } finally {
            await closeWebSocket(connection.socket);
            await vscode.commands.executeCommand("workbench.action.closeAllEditors");
        }
    });
}
