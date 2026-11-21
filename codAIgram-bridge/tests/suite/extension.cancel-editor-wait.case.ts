import type { TestCaseMetadata } from "../testCaseMetadata";
import * as assert from "node:assert";
import * as vscode from "vscode";
import type { RawData } from "ws";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { closeWebSocket, connectWebSocket } from "./extension.helpers";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "cancels editor waits once without affecting other requests or connections",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-18", text: "Cancel pending editor waits with correlated acknowledgment, exactly once and connection isolation." }]
  }
};

function receive(connection: ConnectedWebSocket, count: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const messages: string[] = [];
        const timeout: NodeJS.Timeout = setTimeout(() => {
            connection.socket.removeListener("message", onMessage);
            reject(new Error("Timed out waiting for cancellation responses."));
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

interface ResponseWithId {
    readonly id: string;
}

function responsesById(messages: string[]): ResponseWithId[] {
    return messages.map((message) => JSON.parse(message) as ResponseWithId).sort((left, right) => left.id.localeCompare(right.id));
}

export function registerCancelEditorWaitCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        await vscode.commands.executeCommand("workbench.action.closeAllEditors");
        const api: BridgeApi = getApi();
        const connection: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
        try {
            assert.deepStrictEqual(JSON.parse(await connection.firstMessage), { version: 1, type: "welcome" });
            const invalidBarrier: Promise<string[]> = receive(connection, 1);
            connection.socket.send(JSON.stringify({ version: 1, type: "cancel", id: "bad" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "cancel", id: "bad", targetId: "" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "cancel", id: "bad", targetId: 3 }));
            connection.socket.send(JSON.stringify({ version: 2, type: "cancel", id: "bad", targetId: "first" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "cancel", id: "", targetId: "first" }));
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "bad",
              targetId: "x".repeat(4097)
            }));
            connection.socket.send(Buffer.from('{"version":1,"type":"cancel","id":"bad","targetId":"first"}'));
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "bad",
              targetId: "first",
              extra: true
            }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "invalid-barrier" }));
            assert.deepStrictEqual(JSON.parse((await invalidBarrier)[0]), { version: 1, type: "pong", id: "invalid-barrier" });
            const registrationBarrier: Promise<string[]> = receive(connection, 1);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "wait_for_active_editor_change",
              id: "first" }));
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "wait_for_active_editor_change",
              id: "second" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "registered" }));
            assert.deepStrictEqual(JSON.parse((await registrationBarrier)[0]), { version: 1, type: "pong", id: "registered" });
            const cancellation: Promise<string[]> = receive(connection, 2);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "cancel-one",
              targetId: "first" }));
            assert.deepStrictEqual((await cancellation).map((message) => JSON.parse(message)), [
                {
                  version: 1,
                  type: "cancelled",
                  id: "cancel-one",
                  targetId: "first" },
                {
                  version: 1,
                  type: "error",
                  id: "first",
                  code: "request_cancelled" }
            ]);
            const errors: Promise<string[]> = receive(connection, 2);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "missing",
              targetId: "first" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "still-open" }));
            assert.deepStrictEqual(responsesById(await errors), [
                {
                  version: 1,
                  type: "error",
                  id: "missing",
                  code: "request_not_pending" },
                { version: 1, type: "pong", id: "still-open" }
            ]);
            const editorResponses: Promise<string[]> = receive(connection, 2);
            const document: vscode.TextDocument = await vscode.workspace.openTextDocument({ language: "plaintext" });
            await vscode.window.showTextDocument(document);
            assert.deepStrictEqual((await editorResponses).map((message) => JSON.parse(message)), [
                {
                  version: 1,
                  type: "active_editor_changed",
                  hasActiveEditor: true },
                {
                  version: 1,
                  type: "active_editor_change",
                  id: "second",
                  hasActiveEditor: true }
            ]);
            const completed: Promise<string[]> = receive(connection, 2);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "cancel",
              id: "late",
              targetId: "second" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "after-event" }));
            assert.deepStrictEqual(responsesById(await completed), [
                { version: 1, type: "pong", id: "after-event" },
                {
                  version: 1,
                  type: "error",
                  id: "late",
                  code: "request_not_pending" }
            ]);
            const oldToken: string = api.token;
            const oldBarrier: Promise<string[]> = receive(connection, 1);
            connection.socket.send(JSON.stringify({
              version: 1,
              type: "wait_for_active_editor_change",
              id: "orphan" }));
            connection.socket.send(JSON.stringify({ version: 1, type: "ping", id: "before-close" }));
            assert.deepStrictEqual(JSON.parse((await oldBarrier)[0]), { version: 1, type: "pong", id: "before-close" });
            await closeWebSocket(connection.socket);
            for (let attempt: number = 0; attempt < 40 && api.token === oldToken; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            assert.notStrictEqual(api.token, oldToken);
            const next: ConnectedWebSocket = await connectWebSocket(api.port, api.token);
            try {
                assert.deepStrictEqual(JSON.parse(await next.firstMessage), { version: 1, type: "welcome" });
                const isolation: Promise<string[]> = receive(next, 2);
                next.socket.send(JSON.stringify({
                  version: 1,
                  type: "cancel",
                  id: "new-connection",
                  targetId: "orphan" }));
                next.socket.send(JSON.stringify({ version: 1, type: "ping", id: "isolation" }));
                assert.deepStrictEqual(responsesById(await isolation), [
                    { version: 1, type: "pong", id: "isolation" },
                    {
                      version: 1,
                      type: "error",
                      id: "new-connection",
                      code: "request_not_pending" }
                ]);
            } finally {
                await closeWebSocket(next.socket);
            }
        } finally {
            await closeWebSocket(connection.socket);
            await vscode.commands.executeCommand("workbench.action.closeAllEditors");
        }
    });
}
