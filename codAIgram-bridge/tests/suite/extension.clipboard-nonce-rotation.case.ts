import * as assert from "node:assert";
import * as vscode from "vscode";
import { connectWebSocket, closeWebSocket, rejectUpgrade, trustedOrigin } from "./extension.helpers";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "copies a new nonce after connection and rejects both used nonces",
  prompt: {
    availability: "unavailable",
    reason: "Nonce rotation coverage does not require a prompt.",
    history: []
  }
};

export function registerClipboardNonceRotationCase(getApi: () => BridgeApi): void {
    test(TEST_CASE_METADATA.title, async () => {
        const api: BridgeApi = getApi();
        const firstUrl: string = await vscode.commands.executeCommand("codaigram-bridge.copyConnectionUrl") as string;
        assert.strictEqual(await vscode.env.clipboard.readText(), firstUrl);
        const firstNonce: string = new URL(firstUrl).pathname.slice(1);
        const firstSession: ConnectedWebSocket = await connectWebSocket(api.port, firstNonce, trustedOrigin);
        await closeWebSocket(firstSession.socket);

        for (let attempt: number = 0; attempt < 20 && api.token === firstNonce; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 25));
        }

        const secondUrl: string = await vscode.commands.executeCommand("codaigram-bridge.copyConnectionUrl") as string;
        assert.strictEqual(await vscode.env.clipboard.readText(), secondUrl);
        const secondNonce: string = new URL(secondUrl).pathname.slice(1);
        assert.notStrictEqual(secondNonce, firstNonce);
        const secondSession: ConnectedWebSocket = await connectWebSocket(api.port, secondNonce, trustedOrigin);
        await closeWebSocket(secondSession.socket);

        assert.strictEqual(await rejectUpgrade(api.port, `/${secondNonce}`, `127.0.0.1:${api.port}`, trustedOrigin), 401);
        assert.strictEqual(await rejectUpgrade(api.port, `/${firstNonce}`, `127.0.0.1:${api.port}`, trustedOrigin), 401);
    });
}
