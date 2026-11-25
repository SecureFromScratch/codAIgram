import * as assert from "node:assert";
import * as vscode from "vscode";
import { connectWebSocket, closeWebSocket } from "./extension.helpers";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "accepts a trusted origin with a wildcard port",
  prompt: {
    availability: "unavailable",
    reason: "Origin allowlist syntax coverage does not require a prompt.",
    history: []
  }
};

export function registerTrustedOriginWildcardCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("codaigramBridge");
        const previousOrigins: string[] = configuration.get<string[]>("trustedOrigins", []);
        await configuration.update("trustedOrigins", ["http://127.0.0.1:*"], vscode.ConfigurationTarget.Global);
        try {
            const accepted: ConnectedWebSocket = await connectWebSocket(api.port, api.token, "http://127.0.0.1:45678");
            try {
                assert.deepStrictEqual(JSON.parse(await accepted.firstMessage), { version: 1, type: "welcome" });
            } finally {
                await closeWebSocket(accepted.socket);
            }
        } finally {
            await configuration.update("trustedOrigins", previousOrigins, vscode.ConfigurationTarget.Global);
        }
    });
}
