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
import { registerTokenGenerationCase } from "./extension.token-generation.case";
import { registerShowPairingUrlCase } from "./extension.show-pairing-url.case";
import { registerCopyButtonCase } from "./extension.copy-button.case";
import { registerCopyPairingUrlCase } from "./extension.copy-pairing-url.case";
import { registerRegenerateTokenCase } from "./extension.regenerate-token.case";
import { registerRejectInvalidTokenCase } from "./extension.reject-invalid-token.case";
import { registerConsumeTokenAfterFailedAuthCase } from "./extension.consume-token-after-failed-auth.case";
import { registerRenewTokenAfterDisconnectCase } from "./extension.renew-token-after-disconnect.case";
import { registerDynamicPortHttpCase } from "./extension.dynamic-port-http.case";
import { registerRejectInvalidHostCase } from "./extension.reject-invalid-host.case";
import { registerAcceptLocalhostHostCase } from "./extension.accept-localhost-host.case";
import { registerTrustedOriginRequiredCase } from "./extension.trusted-origin-required.case";
import { registerRejectDnsRebindingCase } from "./extension.reject-dns-rebinding.case";
import { registerHttpsLocalhostWebsocketCase } from "./extension.https-localhost-websocket.case";

const scenario = process.env.CODAIGRAM_BRIDGE_SCENARIO ?? "auth";

if (scenario === "shutdown") {
    suite("CodAIgram Bridge shutdown with an active client", () => {
        setup(async () => {
            const extension = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
            assert.ok(extension, "CodAIgram Bridge must be installed in the Extension Development Host.");
            const api = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
            assert.strictEqual(typeof api.token, "string");

            const scriptPath = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_PATH;
            const openedPath = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_OPENED;
            const closedPath = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_CLOSED;
            const nodeExecutable = process.env.CODAIGRAM_BRIDGE_NODE_EXECUTABLE;
            assert.ok(scriptPath && openedPath && closedPath && nodeExecutable);

            const client = spawn(nodeExecutable, [scriptPath, String(api.port), api.token, openedPath, closedPath], {
                detached: true,
                stdio: "ignore",
                windowsHide: true
            });
            client.unref();
            await waitForFile(openedPath, 5_000);
        });

        registerShutdownClosesClientCase();

        teardown(async () => {
            const portFile = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
            if (typeof portFile === "string") {
                const extension = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
                assert.ok(extension);
                const api = await extension.activate();
                await fs.writeFile(portFile, String(api.port), "utf8");
            }
        });
    });
} else if (scenario === "concurrency") {
    suite("CodAIgram Bridge authentication concurrency", () => {
        let api: BridgeApi;
        setup(async () => {
            const extension = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
            assert.ok(extension, "CodAIgram Bridge must be installed in the Extension Development Host.");
            api = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
            assert.strictEqual(typeof api.token, "string");
        });

        registerConcurrentTokenConnectionsCase(() => api);

        teardown(async () => {
            const portFile = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
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
            const installedExtension = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
            assert.ok(installedExtension, "CodAIgram Bridge must be installed in the Extension Development Host.");
            extension = installedExtension;
            api = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
        });

        registerTokenGenerationCase(() => api);

        registerShowPairingUrlCase(() => api);

        registerCopyButtonCase(() => api);

        registerCopyPairingUrlCase(() => api);

        registerRegenerateTokenCase(() => api);

        registerRejectInvalidTokenCase(() => api);

        registerConsumeTokenAfterFailedAuthCase(() => api);

        registerRenewTokenAfterDisconnectCase(() => api);

        registerDynamicPortHttpCase(() => api);

        registerRejectInvalidHostCase(() => api);

        registerAcceptLocalhostHostCase(() => api);

        registerTrustedOriginRequiredCase(() => api);

        registerRejectDnsRebindingCase(() => api);

        registerHttpsLocalhostWebsocketCase(() => api);

        teardown(async () => {
            const portFile = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
            if (typeof portFile === "string") {
                await fs.writeFile(portFile, String(api.port), "utf8");
            }
        });
    });
}
