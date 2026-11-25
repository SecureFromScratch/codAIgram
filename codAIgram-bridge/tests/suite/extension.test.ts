import type { ChildProcess } from "node:child_process";
import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import * as vscode from "vscode";
import NodeWebSocket from "ws";

import { fixedPort, trustedOrigin, request, rejectUpgrade, upgradeStatus, connectWebSocket, closeWebSocket, waitForFile } from "./extension.helpers";
import type { BridgeApi, ConnectedWebSocket } from "./extension.helpers";
import { registerShutdownClosesClientCase } from "./extension.shutdown-closes-client.case";
import { registerConcurrentTokenConnectionsCase } from "./extension.concurrent-token-connections.case";
import { registerDuplicateRequestIdCase } from "./extension.duplicate-request-id.case";
import { registerRequestOrderCase } from "./extension.request-order.case";
import { registerEditorWaitServerTimeoutCase } from "./extension.editor-wait-timeout.case";
import { registerCancelEditorWaitCase } from "./extension.cancel-editor-wait.case";
import { registerConcurrentEditorWaitsCase } from "./extension.concurrent-editor-waits.case";
import { registerActiveEditorNotificationCase } from "./extension.active-editor-notification.case";
import { registerMessageSizeBoundaryCase } from "./extension.message-size-boundary.case";
import { registerOversizedFragmentsCase } from "./extension.oversized-fragments.case";
import { registerUnsupportedRequestCase } from "./extension.unsupported-request.case";
import { registerBrowserPingCase } from "./extension.browser-ping.case";
import { registerRejectInvalidPingCase } from "./extension.reject-invalid-ping.case";
import { registerTokenGenerationCase } from "./extension.token-generation.case";
import { registerShowPairingUrlCase } from "./extension.show-pairing-url.case";
import { registerCopyButtonCase } from "./extension.copy-button.case";
import { registerCopyPairingUrlCase } from "./extension.copy-pairing-url.case";
import { registerClipboardNonceRotationCase } from "./extension.clipboard-nonce-rotation.case";
import { registerRegenerateTokenCase } from "./extension.regenerate-token.case";
import { registerRejectInvalidTokenCase } from "./extension.reject-invalid-token.case";
import { registerConsumeTokenAfterFailedAuthCase } from "./extension.consume-token-after-failed-auth.case";
import { registerRenewTokenAfterDisconnectCase } from "./extension.renew-token-after-disconnect.case";
import { registerDynamicPortHttpCase } from "./extension.dynamic-port-http.case";
import { registerRejectInvalidHostCase } from "./extension.reject-invalid-host.case";
import { registerAcceptLocalhostHostCase } from "./extension.accept-localhost-host.case";
import { registerTrustedOriginRequiredCase } from "./extension.trusted-origin-required.case";
import { registerTrustedOriginWildcardCase } from "./extension.trusted-origin-wildcard.case";
import { registerRejectDnsRebindingCase } from "./extension.reject-dns-rebinding.case";
import { registerHttpsLocalhostWebsocketCase } from "./extension.https-localhost-websocket.case";
import { registerWorkspaceSyncIntegration } from "./extension.workspace-sync.test";
import { registerBridgeClientConnectCase } from "./extension.bridge-client-connect.case";
import { registerBridgeClientFoldersCase } from "./extension.bridge-client-folders.case";
import { registerBridgeClientPromptCase } from "./extension.bridge-client-prompt.case";
import { registerSessionReconnectCase } from "./extension.session-reconnect.case";
import { registerWorkspaceAgentsCase } from "./workspaceAgents.case";

const scenario: string = process.env.CODAIGRAM_BRIDGE_SCENARIO ?? "auth";

if (scenario === "shutdown") {
    suite("CodAIgram Bridge shutdown with an active client", () => {
        setup(async () => {
            const extension: vscode.Extension<BridgeApi> | undefined = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
            assert.ok(extension, "CodAIgram Bridge must be installed in the Extension Development Host.");
            const api: BridgeApi = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
            assert.strictEqual(typeof api.token, "string");

            const scriptPath: string | undefined = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_PATH;
            const openedPath: string | undefined = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_OPENED;
            const closedPath: string | undefined = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_CLOSED;
            const nodeExecutable: string | undefined = process.env.CODAIGRAM_BRIDGE_NODE_EXECUTABLE;
            assert.ok(scriptPath && openedPath && closedPath && nodeExecutable);

            const client: ChildProcess = spawn(nodeExecutable, [scriptPath, String(api.port), api.token, openedPath, closedPath], { detached: true, stdio: "ignore", windowsHide: true });
            client.unref();
            // Do not let the host proceed to shutdown until the detached client has received the welcome frame; this proves it is authenticated and still connected.
            await waitForFile(openedPath, 5_000);
        });

        registerShutdownClosesClientCase();

        teardown(async () => {
            const portFile: string | undefined = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
            if (typeof portFile === "string") {
                const extension: vscode.Extension<BridgeApi> | undefined = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
                assert.ok(extension);
                const api: BridgeApi = await extension.activate();
                await fs.writeFile(portFile, String(api.port), "utf8");
            }
        });
    });
} else if (scenario === "concurrency") {
    suite("CodAIgram Bridge authentication concurrency", () => {
        let api: BridgeApi;
        setup(async () => {
            const extension: vscode.Extension<BridgeApi> | undefined = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
            assert.ok(extension, "CodAIgram Bridge must be installed in the Extension Development Host.");
            api = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
            assert.strictEqual(typeof api.token, "string");
        });

        registerConcurrentTokenConnectionsCase(() => api);

        teardown(async () => {
            const portFile: string | undefined = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
            if (typeof portFile === "string") {
                await fs.writeFile(portFile, String(api.port), "utf8");
            }
        });
    });
} else {
    suite("CodAIgram Bridge authentication", () => {
        let api: BridgeApi;
        let extension: vscode.Extension<BridgeApi>;
        setup(async () => {
            const installedExtension: vscode.Extension<BridgeApi> | undefined = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
            assert.ok(installedExtension, "CodAIgram Bridge must be installed in the Extension Development Host.");
            extension = installedExtension;
            api = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
        });

        registerRequestOrderCase(() => api);

        registerDuplicateRequestIdCase(() => api);

        registerEditorWaitServerTimeoutCase(() => api);

        registerCancelEditorWaitCase(() => api);

        registerConcurrentEditorWaitsCase(() => api);

        registerActiveEditorNotificationCase(() => api);

        registerMessageSizeBoundaryCase(() => api);

        registerOversizedFragmentsCase(() => api);

        registerUnsupportedRequestCase(() => api);

        registerBrowserPingCase(() => api);

        registerRejectInvalidPingCase(() => api);

        registerTokenGenerationCase(() => api);

        registerShowPairingUrlCase(() => api);

        registerCopyButtonCase(() => api);

        registerCopyPairingUrlCase(() => api);
        registerClipboardNonceRotationCase(() => api);

        registerRegenerateTokenCase(() => api);

        registerRejectInvalidTokenCase(() => api);

        registerConsumeTokenAfterFailedAuthCase(() => api);

        registerRenewTokenAfterDisconnectCase(() => api);

        registerDynamicPortHttpCase(() => api);

        registerRejectInvalidHostCase(() => api);

        registerAcceptLocalhostHostCase(() => api);

        registerTrustedOriginRequiredCase(() => api);
        registerTrustedOriginWildcardCase(() => api);

        registerRejectDnsRebindingCase(() => api);

        registerHttpsLocalhostWebsocketCase(() => api);

        registerWorkspaceSyncIntegration(() => api);

        registerBridgeClientConnectCase(() => api, trustedOrigin);
        registerBridgeClientFoldersCase(() => api, trustedOrigin);
        registerBridgeClientPromptCase(() => api, trustedOrigin);
        registerSessionReconnectCase(() => api, trustedOrigin);
        registerWorkspaceAgentsCase(() => api);

        teardown(async () => {
            const portFile: string | undefined = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
            if (typeof portFile === "string") {
                await fs.writeFile(portFile, String(api.port), "utf8");
            }
        });
    });
}
