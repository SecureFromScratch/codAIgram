import * as fs from "node:fs/promises";
import * as https from "node:https";
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { X509Certificate } from "node:crypto";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";
import selfsigned from "selfsigned";

const host = "127.0.0.1";
const port = 11100;
const projectRoot = path.resolve(__dirname, "../..");

const shutdownClientScript = `
const fs = require("node:fs");
const WebSocket = require("ws");
const [port, token, openedFile, closedFile] = process.argv.slice(2);
const socket = new WebSocket("ws://127.0.0.1:" + port + "/" + token, {
    headers: { Origin: "https://codai.example" }
});
socket.on("message", (message) => {
    if (message.toString() === "Hello") fs.writeFileSync(openedFile, "hello");
});
socket.on("close", (code, reason) => {
    fs.writeFileSync(closedFile, JSON.stringify({ code, reason: reason.toString() }));
    process.exit(0);
});
socket.on("error", () => {});
setTimeout(() => process.exit(2), 20000);
`;

async function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            await fs.access(filePath);
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
    throw new Error(`Timed out waiting for ${path.basename(filePath)}.`);
}

async function startHttpsFixture(): Promise<{ server: https.Server; url: string; origin: string }> {
    const certificateDirectory = path.join(projectRoot, ".test-ca");
    const caCertificatePath = path.join(certificateDirectory, "ca.pem");
    const caPrivateKeyPath = path.join(certificateDirectory, "ca-key.pem");
    await fs.mkdir(certificateDirectory, { recursive: true });

    let caCertificate: string;
    let caPrivateKey: string;
    try {
        [caCertificate, caPrivateKey] = await Promise.all([
            fs.readFile(caCertificatePath, "utf8"),
            fs.readFile(caPrivateKeyPath, "utf8")
        ]);
    } catch {
        const generatedCa = await selfsigned.generate(
            [{ name: "commonName", value: "CodAIgram Bridge Test CA" }],
            {
                algorithm: "sha256",
                extensions: [
                    { name: "basicConstraints", cA: true },
                    { name: "keyUsage", keyCertSign: true, cRLSign: true }
                ]
            }
        );
        caCertificate = generatedCa.cert;
        caPrivateKey = generatedCa.private;
        await Promise.all([
            fs.writeFile(caCertificatePath, caCertificate, { encoding: "utf8", mode: 0o644 }),
            fs.writeFile(caPrivateKeyPath, caPrivateKey, { encoding: "utf8", mode: 0o600 })
        ]);
    }

    const caThumbprint = new X509Certificate(caCertificate).fingerprint.replace(/:/g, "");
    try {
        execFileSync("certutil.exe", ["-user", "-store", "Root", caThumbprint], { stdio: "ignore" });
    } catch {
        execFileSync("certutil.exe", ["-user", "-addstore", "Root", caCertificatePath], { stdio: "ignore" });
    }

    const certificate = await selfsigned.generate(
        [{ name: "commonName", value: "127.0.0.1" }],
        {
            algorithm: "sha256",
            ca: { key: caPrivateKey, cert: caCertificate },
            extensions: [{ name: "subjectAltName", altNames: [{ type: 7, ip: "127.0.0.1" }] }]
        }
    );
    const server = https.createServer({ key: certificate.private, cert: certificate.cert }, (_request, response) => {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><html><body><p>CodAIgram HTTPS browser test</p></body></html>");
    });
    const fixturePort = await new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (address === null || typeof address === "string") {
                reject(new Error("HTTPS fixture did not receive a TCP port."));
                return;
            }
            resolve(address.port);
        });
    });
    const origin = `https://127.0.0.1:${fixturePort}`;
    return { server, origin, url: `${origin}/` };
}

async function startHttpFixture(): Promise<{ server: import("node:http").Server; url: string; origin: string }> {
    const http = await import("node:http");
    const server = http.createServer((_request, response) => {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><html><body><p>CodAIgram DNS rebinding test</p></body></html>");
    });
    const fixturePort = await new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (address === null || typeof address === "string") {
                reject(new Error("HTTP fixture did not receive a TCP port."));
                return;
            }
            resolve(address.port);
        });
    });
    const origin = `http://127.0.0.1:${fixturePort}`;
    return { server, origin, url: `${origin}/` };
}

async function findChromiumExecutable(): Promise<string> {
    const candidates = [
        process.env.PROGRAMFILES === undefined ? undefined : path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
        process.env["PROGRAMFILES(X86)"] === undefined ? undefined : path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe")
    ];
    for (const candidate of candidates) {
        if (candidate === undefined) continue;
        try {
            await fs.access(candidate);
            return candidate;
        } catch {
            // Check the next installed Chromium browser.
        }
    }
    throw new Error("The HTTPS browser test requires installed Chrome or Edge.");
}

async function assertPortIsAvailable(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const probe = net.createServer();
        probe.once("error", (error) => reject(new Error(`Port ${port} is already in use: ${error.message}`)));
        probe.listen(port, host, () => {
            probe.close((error) => error === undefined ? resolve() : reject(error));
        });
    });
}

async function occupyFixedPort(): Promise<net.Server> {
    const occupied = net.createServer();
    await new Promise<void>((resolve, reject) => {
        occupied.once("error", reject);
        occupied.listen(port, host, () => resolve());
    });
    return occupied;
}

async function assertPortIsClosed(portToCheck: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host, port: portToCheck });
        socket.setTimeout(2_000);
        socket.once("connect", () => {
            socket.destroy();
            reject(new Error(`Port ${portToCheck} still accepts connections after the VS Code test host exited.`));
        });
        socket.once("error", () => resolve());
        socket.once("timeout", () => {
            socket.destroy();
            reject(new Error(`Timed out while verifying that port ${portToCheck} was released.`));
        });
    });
}

async function runScenario(scenario: string): Promise<void> {
    const extensionDevelopmentPath = path.resolve(__dirname, "../..");
    const extensionTestsPath = path.resolve(__dirname, "suite/index.js");
    const temporaryRoot = await fs.mkdtemp(path.join(projectRoot, "codaigram-bridge-vscode-"));
    const userDataDir = path.join(temporaryRoot, "user-data");
    const extensionsDir = path.join(temporaryRoot, "extensions");
    const portFile = path.join(temporaryRoot, "allocated-port.txt");
    const openedFile = path.join(temporaryRoot, "shutdown-client-opened.txt");
    const closedFile = path.join(temporaryRoot, "shutdown-client-closed.json");
    const shutdownClientPath = path.join(temporaryRoot, "shutdown-client.cjs");
    let occupiedPort: net.Server | undefined;
    const httpsFixture = await startHttpsFixture();
    const httpFixture = await startHttpFixture();

    try {
        await fs.writeFile(shutdownClientPath, shutdownClientScript, "utf8");
        await fs.mkdir(path.join(userDataDir, "User"), { recursive: true });
        await fs.writeFile(path.join(userDataDir, "User", "settings.json"), JSON.stringify({ "codaigramBridge.trustedOrigins": ["https://codai.example", httpsFixture.origin, httpFixture.origin] }), "utf8");
        await assertPortIsAvailable();
        occupiedPort = await occupyFixedPort();
        const electronRunAsNode = process.env.ELECTRON_RUN_AS_NODE;
        delete process.env.ELECTRON_RUN_AS_NODE;
        try {
            await runTests({
                version: "1.146.0",
                extensionDevelopmentPath,
                extensionTestsPath,
                extensionTestsEnv: {
                    CODAIGRAM_BRIDGE_PORT_FILE: portFile,
                    CODAIGRAM_BRIDGE_SCENARIO: scenario,
                    CODAIGRAM_BRIDGE_HTTPS_URL: httpsFixture.url,
                    CODAIGRAM_BRIDGE_HTTP_URL: httpFixture.url,
                    CODAIGRAM_BRIDGE_CHROMIUM_PATH: await findChromiumExecutable(),
                    CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_PATH: shutdownClientPath,
                    CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_OPENED: openedFile,
                    CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_CLOSED: closedFile,
                    CODAIGRAM_BRIDGE_NODE_EXECUTABLE: process.execPath
                },
                launchArgs: [
                    "--disable-extensions",
                    `--user-data-dir=${userDataDir}`,
                    `--extensions-dir=${extensionsDir}`
                ]
            });
        } finally {
            if (electronRunAsNode === undefined) {
                delete process.env.ELECTRON_RUN_AS_NODE;
            } else {
                process.env.ELECTRON_RUN_AS_NODE = electronRunAsNode;
            }
        }
        if (scenario === "shutdown") {
            await waitForFile(closedFile, 5_000);
            const shutdownResult = JSON.parse(await fs.readFile(closedFile, "utf8")) as { code: number };
            if (shutdownResult.code !== 1006) {
                throw new Error(`Expected abrupt WebSocket closure during extension shutdown, received code ${shutdownResult.code}.`);
            }
        }
        const allocatedPort = Number.parseInt(await fs.readFile(portFile, "utf8"), 10);
        await assertPortIsClosed(allocatedPort);
    } finally {
        await new Promise<void>((resolve) => {
            if (occupiedPort === undefined) {
                resolve();
                return;
            }
            occupiedPort.close(() => resolve());
        });
        await fs.rm(temporaryRoot, { recursive: true, force: true });
        await new Promise<void>((resolve) => httpsFixture.server.close(() => resolve()));
        await new Promise<void>((resolve) => httpFixture.server.close(() => resolve()));
    }
}

async function main(): Promise<void> {
    await runScenario("auth");
    await runScenario("concurrency");
    await runScenario("shutdown");
}

void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});



