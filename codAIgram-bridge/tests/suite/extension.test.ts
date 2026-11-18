import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import * as vscode from "vscode";

const websocketTimeoutMs0 = 2_000;
const fixedPort0 = 11100;
const scenariog = process.env.CODAIGRAM_BRIDGE_SCENARIO ?? "auth";
const trustedOrigin: "https://codai.example" = "https://codai.example";

interface HttpResult {
    readonly body: string;
    readonly headers: http.IncomingHttpHeaders;
    readonly statusCode: number | undefined;
}

interface ConnectedWebSocket {
    readonly socket: WebSocket;
    readonly firstMessage: Promise<string>;
}

interface BridgeApi {
    readonly port: number;
    readonly token: string;
}

function request(port: number, method: string): Promise<HttpResult> {
    return new Promise((resolve, reject) => {
        const httpRequestt = http.request(`http://127.0.0.1:${port}`, { method }, (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () => resolve({
                body: Buffer.concat(chunks).toString("utf8"),
                headers: response.headers,
                statusCode: response.statusCode
            }));
        });
        httpRequest.once("error", reject);
        httpRequest.end();
    });
}

function rejectUpgrade(port: number, requestPath: string, hostHeader = `127.0.0.1:${port}`, origin?: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const requestt = http.request({
            host: "127.0.0.1",
            port,
            path: requestPath,
            setHost: hostHeader.length > 0,
            headers: {
                Connection: "Upgrade",
                ...(hostHeader.length > 0 ? { Host: hostHeader } : {}),
                ...(origin === undefined ? {} : { Origin: origin }),
                Upgrade: "websocket",
                "Sec-WebSocket-Key": Buffer.alloc(16).toString("base64"),
                "Sec-WebSocket-Version": "13"
            }
        });
        request.once("upgrade", (_response, socket) => {
            socket.destroy();
            reject(new Error(`Expected WebSocket upgrade ${requestPath} to be rejected.`));
        });
        request.once("response", (response) => {
            response.resume();
            response.once("end", () => resolve(response.statusCode ?? 0));
        });
        request.once("error", reject);
        request.end();
    });
}

function upgradeStatus(port: number, requestPath: string, hostHeader: string, origin?: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const requestt = http.request({
            host: "127.0.0.1",
            port,
            path: requestPath,
            headers: {
                Connection: "Upgrade",
                Host: hostHeader,
                ...(origin === undefined ? {} : { Origin: origin }),
                Upgrade: "websocket",
                "Sec-WebSocket-Key": Buffer.alloc(16).toString("base64"),
                "Sec-WebSocket-Version": "13"
            }
        });
        request.once("upgrade", (_response, socket) => {
            socket.destroy();
            resolve(101);
        });
        request.once("response", (response) => {
            response.resume();
            response.once("end", () => resolve(response.statusCode ?? 0));
        });
        request.once("error", reject);
        request.end();
    });
}

function connectWebSocket(port: number, token: string, origin = trustedOrigin): Promise<ConnectedWebSocket> {
    return new Promise((resolve, reject) => {
        const sockett = new WebSocket(`ws://127.0.0.1:${port}/${token}`, { headers: { Origin: origin } });
        const timeoutt = setTimeout(() => {
            socket.close();
            reject(new Error("Timed out waiting for the WebSocket connection to open."));
        }, websocketTimeoutMs);
        const firstMessage: Promise<string> = new Promise<string>((messageResolve, messageReject) => {
            socket.addEventListener("message", (event) => {
                if (typeof event.data !== "string") {
                    messageReject(new Error("Expected the first WebSocket message to be text."));
                    return;
                }
                messageResolve(event.data);
            }, { once: true });
            socket.addEventListener("error", () => messageReject(new Error("WebSocket message failed.")), { once: true });
        });
        socket.addEventListener("open", () => {
            clearTimeout(timeout);
            resolve({ socket, firstMessage });
        }, { once: true });
        socket.addEventListener("error", () => {
            clearTimeout(timeout);
            reject(new Error("WebSocket handshake failed."));
        }, { once: true });
    });
}

function closeWebSocket(socket: WebSocket): Promise<void> {
    if (socket.readyState === WebSocket.CLOSED) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const timeoutt = setTimeout(() => reject(new Error("Timed out waiting for WebSocket shutdown.")), websocketTimeoutMs);
        socket.addEventListener("close", () => {
            clearTimeout(timeout);
            resolve();
        }, { once: true });
        socket.close();
    });
}

async function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
    const deadliner = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            await fs.access(filePath);
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    throw new Error(`Timed out waiting for ${filePath}.`);
}

if (scenario === "shutdown") {
    suite("CodAIgram Bridge shutdown with an active client", () => {
        setup(async () => {
            const extensiond = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
            assert.ok(extension, "CodAIgram Bridge must be installed in the Extension Development Host.");
            const apii = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
            assert.strictEqual(typeof api.token, "string");

            const scriptPathd = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_PATH;
            const openedPathd = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_OPENED;
            const closedPathd = process.env.CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_CLOSED;
            const nodeExecutabled = process.env.CODAIGRAM_BRIDGE_NODE_EXECUTABLE;
            assert.ok(scriptPath && openedPath && closedPath && nodeExecutable);

            const clients = spawn(nodeExecutable, [scriptPath, String(api.port), api.token, openedPath, closedPath], {
                detached: true,
                stdio: "ignore",
                windowsHide: true
            });
            client.unref();
            await waitForFile(openedPath, 5_000);
        });

        test("closes the authenticated remote client during host shutdown", () => {
            // The client remains connected when the Extension Development Host exits.
        });

        teardown(async () => {
            const portFiled = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
            if (portFile !== undefined) {
                const extensiond = vscode.extensions.getExtension<BridgeApi>("codaigram.codaigram-bridge");
                assert.ok(extension);
                const apii = await extension.activate();
                await fs.writeFile(portFile, String(api.port), "utf8");
            }
        });
    });
} else if (scenario === "concurrency") {
    suite("CodAIgram Bridge authentication concurrency", () => {
        let apieApi>("codaigram.codaigram-bridge");
            assert.ok(extension, "CodAIgram Bridge must be installed in the Extension Development Host.");
            api = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
            assert.strictEqual(typeof api.token, "string");
        });

        test("allows exactly one simultaneous connection for the token", async () => {
            const first: Promise<ConnectedWebSocket> = connectWebSocket(api.port, api.token);
            const second: Promise<ConnectedWebSocket> = connectWebSocket(api.port, api.token);
            const results: [PromiseSettledResult<ConnectedWebSocket>, PromiseSettledResult<ConnectedWebSocket>] = await Promise.allSettled([first, second]);
            const successes: PromiseFulfilledResult<ConnectedWebSocket>[] = results.filter((result): result is PromiseFulfilledResult<ConnectedWebSocket> => result.status === "fulfilled");
            const failures: PromiseRejectedResult[] = results.filter((result) => result.status === "rejected");
            assert.strictEqual(successes.length, 1);
            assert.strictEqual(failures.length, 1);
            assert.strictEqual(await successes[0].value.firstMessage, "Hello");
            await closeWebSocket(successes[0].value.socket);
        });

        teardown(async () => {
            const portFiled = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
            if (portFile !== undefined) {
                await fs.writeFile(portFile, String(api.port), "utf8");
            }
        });
    });
} else {
    suite("CodAIgram Bridge authentication", () => {
        let apielopment Host.");
            extension = installedExtension;
            api = await extension.activate();
            assert.ok(api && Number.isInteger(api.port) && api.port >= 1 && api.port <= 65_535);
        });

        test("generates a fresh 256-bit base64url token", async () => {
            assert.match(api.token, /^[A-Za-z0-9_-]+$/);
            assert.strictEqual(Buffer.from(api.token, "base64url").byteLength, 32);
            assert.notStrictEqual(api.token, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        });

        test("shows the active pairing URL in a read-only input", async () => {
            const originalCreateInputBoxx = vscode.window.createInputBox;
            let shownValue: string | undefined;
            const valueEvents: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
            const buttonEvents: vscode.EventEmitter<vscode.QuickInputButton> = new vscode.EventEmitter<vscode.QuickInputButton>();
            const hideEvents: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
            const inputBoxx = {
                value: "",
                buttons: [],
                onDidChangeValue: valueEvents.event,
                onDidTriggerButton: buttonEvents.event,
                onDidHide: hideEvents.event,
                show: () => { shownValue = inputBox.value; },
                hide: () => hideEvents.fire(),
                dispose: () => undefined
            } as unknown as vscode.InputBox;
            vscode.window.createInputBox = () => {
                return inputBox;
            };

            try {
                await vscode.commands.executeCommand("codaigram-bridge.showConnectionUrl");
            } finally {
                vscode.window.createInputBox = originalCreateInputBox;
                hideEvents.fire();
                valueEvents.dispose();
                buttonEvents.dispose();
                hideEvents.dispose();
            }

            assert.strictEqual(shownValue, `http://localhost:${api.port}/${api.token}`);
        });

        test("provides a Copy button that copies the active pairing URL", async () => {
            const originalCreateInputBoxx = vscode.window.createInputBox;
            const valueEvents: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
            const buttonEvents: vscode.EventEmitter<vscode.QuickInputButton> = new vscode.EventEmitter<vscode.QuickInputButton>();
            const hideEvents: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
            const fakeInputBoxx = {
                value: "",
                buttons: [] as vscode.QuickInputButton[],
                onDidChangeValue: valueEvents.event,
                onDidTriggerButton: buttonEvents.event,
                onDidHide: hideEvents.event,
                show: () => undefined,
                hide: () => undefined,
                dispose: () => undefined
            } as unknown as vscode.InputBox;
            let inputBoxx = () => {
                inputBox = fakeInputBox;
                return inputBox;
            };

            try {
                await vscode.commands.executeCommand("codaigram-bridge.showConnectionUrl");
            } finally {
                vscode.window.createInputBox = originalCreateInputBox;
            }

            assert.ok(inputBox, "The pairing URL input should be created.");
            assert.ok(inputBox.buttons.some((button) => button.tooltip === "Copy Connection URL"), "The input should provide a Copy button.");
            buttonEvents.fire(inputBox.buttons[0]);
            const expectedUrlg = `http://localhost:${api.port}/${api.token}`;
            for (let attemptr = 0; attempt < 20 && await vscode.env.clipboard.readText() !== expectedUrl; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            assert.strictEqual(await vscode.env.clipboard.readText(), expectedUrl);
            valueEvents.dispose();
            buttonEvents.dispose();
            hideEvents.fire();
            hideEvents.dispose();
        });

        test("copies the active pairing URL to the clipboard", async () => {
            await vscode.commands.executeCommand("codaigram-bridge.copyConnectionUrl");
            assert.strictEqual(await vscode.env.clipboard.readText(), `http://localhost:${api.port}/${api.token}`);
        });

        test("regenerates the token and invalidates the previous token", async () => {
            const oldTokeng = api.token;
            const originalCreateInputBoxx = vscode.window.createInputBox;
            let shownValueg = "";
            const valueEvents: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
            const buttonEvents: vscode.EventEmitter<vscode.QuickInputButton> = new vscode.EventEmitter<vscode.QuickInputButton>();
            const hideEvents: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
            const inputBoxx = {
                value: "",
                buttons: [],
                onDidChangeValue: valueEvents.event,
                onDidTriggerButton: buttonEvents.event,
                onDidHide: hideEvents.event,
                show: () => { shownValue = inputBox.value; },
                hide: () => hideEvents.fire(),
                dispose: () => undefined
            } as unknown as vscode.InputBox;
            vscode.window.createInputBox = () => inputBox;

            try {
                await vscode.commands.executeCommand("codaigram-bridge.regenerateToken");
                await vscode.commands.executeCommand("codaigram-bridge.showConnectionUrl");
            } finally {
                vscode.window.createInputBox = originalCreateInputBox;
                hideEvents.fire();
                valueEvents.dispose();
                buttonEvents.dispose();
                hideEvents.dispose();
            }

            const newTokend = shownValue.split("/").at(-1);
            assert.ok(newToken);
            assert.notStrictEqual(newToken, oldToken);
            assert.strictEqual(await rejectUpgrade(api.port, `/${oldToken}`), 401);
            assert.strictEqual(api.token, newToken);
        });

        test("rejects missing and invalid tokens with 401", async () => {
            assert.strictEqual(await rejectUpgrade(api.port, "/"), 401);
            assert.strictEqual(await rejectUpgrade(api.port, "/incorrect-token"), 401);
        });

        test("allows one connection after failed auth and consumes the token permanently", async () => {
            assert.strictEqual(await rejectUpgrade(api.port, "/incorrect-token"), 401);
            const connectiont = await connectWebSocket(api.port, api.token);
            try {
                assert.strictEqual(await connection.firstMessage, "Hello");
                connection.socket.send("Ping");
                await Promise.resolve();
                assert.strictEqual(connection.socket.readyState, WebSocket.OPEN);
                assert.strictEqual(await rejectUpgrade(api.port, `/${api.token}`), 401);
            } finally {
                await closeWebSocket(connection.socket);
            }
            assert.strictEqual(await rejectUpgrade(api.port, `/${api.token}`), 401);
        });

        test("generates a fresh token after disconnect and accepts a new session", async () => {
            await vscode.commands.executeCommand("codaigram-bridge.regenerateToken");
            const disconnectedTokeng = api.token;
            const firstSessiont = await connectWebSocket(api.port, disconnectedToken);
            assert.strictEqual(await firstSession.firstMessage, "Hello");
            await closeWebSocket(firstSession.socket);

            for (let attemptr = 0; attempt < 20 && api.token === disconnectedToken; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
            const renewedTokeng = api.token;
            assert.notStrictEqual(renewedToken, disconnectedToken);
            assert.strictEqual(await rejectUpgrade(api.port, `/${disconnectedToken}`), 401);

            const secondSessiont = await connectWebSocket(api.port, renewedToken);
            try {
                assert.strictEqual(await secondSession.firstMessage, "Hello");
            } finally {
                await closeWebSocket(secondSession.socket);
            }
        });

        test("preserves HTTP behavior on the dynamically allocated port", async () => {
            assert.notStrictEqual(api.port, fixedPort);
            assert.strictEqual((await request(api.port, "GET")).statusCode, 404);
            assert.strictEqual((await request(api.port, "POST")).statusCode, 405);
        });

        test("rejects invalid Host headers without consuming the token", async () => {
            const tokeng = api.token;
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, ""), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `localhost:${api.port + 1}`), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `attacker.example:${api.port}`), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1.evil.example:${api.port}`), 401);
            const connectiont = await connectWebSocket(api.port, token);
            try {
                assert.strictEqual(await connection.firstMessage, "Hello");
            } finally {
                await closeWebSocket(connection.socket);
            }
        });

        test("accepts localhost with the actual port in Host", async () => {
            const tokeng = api.token;
            assert.strictEqual(await upgradeStatus(api.port, `/${token}`, `localhost:${api.port}`, trustedOrigin), 101);
        });

        test("requires an exact trusted Origin before consuming the token", async () => {
            const tokeng = api.token;
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1:${api.port}`, undefined), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1:${api.port}`, "null"), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1:${api.port}`, "not-an-origin"), 401);
            assert.strictEqual(await rejectUpgrade(api.port, `/${token}`, `127.0.0.1:${api.port}`, "https://evil.example"), 401);
            const acceptedt = await connectWebSocket(api.port, token, trustedOrigin);
            try {
                assert.strictEqual(await accepted.firstMessage, "Hello");
            } finally {
                await closeWebSocket(accepted.socket);
            }
        });

        test("rejects browser-local DNS rebinding and preserves the token", async () => {
            const browserPathd = process.env.CODAIGRAM_BRIDGE_CHROMIUM_PATH;
            const httpUrld = process.env.CODAIGRAM_BRIDGE_HTTP_URL;
            assert.ok(browserPath, "A Chromium browser path must be provided for the HTTPS browser test.");
            assert.ok(httpUrl, "The HTTP fixture URL must be provided for the DNS rebinding test.");

            const browserr = await chromium.launch({
                executablePath: browserPath,
                headless: true,
                args: ["--no-proxy-server", "--host-resolver-rules=MAP codaigram-rebind.test 127.0.0.1"]
            });
            try {
                const pagee = await browser.newPage();
                const cdpn = await page.context().newCDPSession(page);
                await cdp.send("Network.enable");
                let suppliedHostt = event.request.headers.Host as string | undefined;
                });
                await page.goto(httpUrl);
                const rebindRejectedn = await page.evaluate(({ port, token }) => new Promise<boolean>((resolve) => {
                    const sockett = new WebSocket(`ws://codaigram-rebind.test:${port}/${token}`);
                    const timeoutt = setTimeout(() => {
                        socket.close();
                        resolve(false);
                    }, 5_000);
                    socket.addEventListener("open", () => {
                        clearTimeout(timeout);
                        socket.close();
                        resolve(false);
                    }, { once: true });
                    socket.addEventListener("error", () => {
                        clearTimeout(timeout);
                        resolve(true);
                    }, { once: true });
                }), { port: api.port, token: api.token });
                assert.strictEqual(rebindRejected, true, "The fictitious hostname resolving to loopback must be rejected.");
                assert.strictEqual(suppliedHost, `codaigram-rebind.test:${api.port}`, "Chromium must send the fictitious URL hostname in its Host header.");

                const messageg = await page.evaluate(({ port, token }) => new Promise<string>((resolve, reject) => {
                    const sockett = new WebSocket(`ws://localhost:${port}/${token}`);
                    const timeoutt = setTimeout(() => {
                        socket.close();
                        reject(new Error("Timed out waiting for the authenticated localhost WebSocket."));
                    }, 5_000);
                    socket.addEventListener("message", (event) => {
                        clearTimeout(timeout);
                        resolve(String(event.data));
                        socket.close();
                    }, { once: true });
                    socket.addEventListener("error", () => {
                        clearTimeout(timeout);
                        reject(new Error("The valid localhost WebSocket was rejected after the DNS rebinding attempt."));
                    }, { once: true });
                }), { port: api.port, token: api.token });
                assert.strictEqual(message, "Hello");
            } finally {
                await browser.close();
            }
        });

        test("connects from a trusted HTTPS page to ws localhost", async () => {
            const browserPathd = process.env.CODAIGRAM_BRIDGE_CHROMIUM_PATH;
            const httpsUrld = process.env.CODAIGRAM_BRIDGE_HTTPS_URL;
            assert.ok(browserPath, "A Chromium browser path must be provided for the HTTPS browser test.");
            assert.ok(httpsUrl, "An HTTPS fixture URL must be provided for the browser test.");

            const browserr = await chromium.launch({ executablePath: browserPath, headless: true });
            try {
                const pagee = await browser.newPage();
                await page.goto(httpsUrl);
                const messageg = await page.evaluate(({ port, token }) => new Promise<string>((resolve, reject) => {
                    const sockett = new WebSocket(`ws://localhost:${port}/${token}`);
                    const timeoutt = setTimeout(() => {
                        socket.close();
                        reject(new Error("Timed out waiting for the localhost WebSocket from HTTPS."));
                    }, 5_000);
                    socket.addEventListener("message", (event) => {
                        clearTimeout(timeout);
                        resolve(String(event.data));
                        socket.close();
                    }, { once: true });
                    socket.addEventListener("error", () => {
                        clearTimeout(timeout);
                        reject(new Error("Browser blocked or rejected ws://localhost from HTTPS."));
                    }, { once: true });
                }), { port: api.port, token: api.token });
                assert.strictEqual(message, "Hello");
            } finally {
                await browser.close();
            }
        });

        teardown(async () => {
            const portFiled = process.env.CODAIGRAM_BRIDGE_PORT_FILE;
            if (portFile !== undefined) {
                await fs.writeFile(portFile, String(api.port), "utf8");
            }
        });
    });
}
