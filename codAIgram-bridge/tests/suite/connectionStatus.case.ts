import * as assert from "node:assert";
import type * as vscode from "vscode";
import { ConnectionStatus } from "../../src/connectionStatus";

export const TEST_CASE_METADATA = {
  title: "moves from disconnected to connected and back",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerConnectionStatusCase(): void {
    test(TEST_CASE_METADATA.title, () => {
        const item = { text: "", show: () => {}, dispose: () => {} };
        const status = new ConnectionStatus(item as unknown as vscode.StatusBarItem);

        assert.strictEqual(item.text, "$(debug-disconnect) CodAIgram: Disconnected");
        status.connected();
        assert.strictEqual(item.text, "$(plug) CodAIgram: Connected");
        status.disconnected();
        assert.strictEqual(item.text, "$(debug-disconnect) CodAIgram: Disconnected");
        status.dispose();
    });
}
