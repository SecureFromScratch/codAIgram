import * as assert from "node:assert";
import type * as vscode from "vscode";
import { ConnectionStatus } from "../../src/connectionStatus";

suite("CodAIgram Bridge connection status", () => {
    test("moves from disconnected to connected and back", () => {
        const item = { text: "", show: () => undefined, dispose: () => undefined };
        const status = new ConnectionStatus(item as unknown as vscode.StatusBarItem);

        assert.strictEqual(item.text, "$(debug-disconnect) CodAIgram: Disconnected");
        status.connected();
        assert.strictEqual(item.text, "$(plug) CodAIgram: Connected");
        status.disconnected();
        assert.strictEqual(item.text, "$(debug-disconnect) CodAIgram: Disconnected");
        status.dispose();
    });
});

