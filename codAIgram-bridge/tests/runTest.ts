import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { X509Certificate } from "node:crypto";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";
import selfsigned from "selfsigned";
import { supportsHttpsFixture } from "./httpsSupport";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

const host: string = "127.0.0.1";
const port: number = 11100;
const projectRoot: string = path.resolve(__dirname, "../..");

type ExtensionTestsEnvT = {
  CODAIGRAM_BRIDGE_PORT_FILE: string;
  CODAIGRAM_BRIDGE_SCENARIO: string;
  CODAIGRAM_BRIDGE_HTTP_URL: string;
  CODAIGRAM_BRIDGE_HTTPS_URL?: string;
  CODAIGRAM_BRIDGE_CHROMIUM_PATH: string;
  CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_PATH: string;
  CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_OPENED: string;
  CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_CLOSED: string;
  CODAIGRAM_BRIDGE_NODE_EXECUTABLE: string;
  CODAIGRAM_BRIDGE_TEMP_DIRECTORY: string;
  TEMP: string;
  TMP: string;
  TMPDIR: string;
  NODE_PATH: string;
};

const shutdownClientScript: string = `
const fs = require("node:fs");
const WebSocket = require("ws");
const [port, token, openedFile, closedFile] = process.argv.slice(2);
const socket = new WebSocket("ws://127.0.0.1:" + port + "/" + token, {
    headers: { Origin: "https://codai.example" }
});
socket.on("message", (message) => {
    const welcome = JSON.parse(message.toString());
    // Tell the Extension Development Host setup that authentication completed and this external client is now held open.
    if (welcome.version === 1 && welcome.type === "welcome" && Object.keys(welcome).length === 2) fs.writeFileSync(openedFile, "welcome");
});
socket.on("close", (code, reason) => {
    // The outer runner reads this after VS Code exits to verify shutdown closed the active socket abnormally.
    fs.writeFileSync(closedFile, JSON.stringify({ code, reason: reason.toString() }));
    process.exit(0);
});
socket.on("error", () => {});
setTimeout(() => process.exit(2), 20000);
`;

async function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
    const deadline: number = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (existsSync(filePath)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    // UNTRUST-ALLOW-UNLOGGED-THROW: The top-level integration runner reports this timeout once; logging here would duplicate the final failure and may reveal local fixture paths.
    throw new Error(`Timed out waiting for ${path.basename(filePath)}.`);
}

async function startHttpsFixture(): Promise<{ server: https.Server; url: string; origin: string }> {
    const certificateDirectory: string = path.join(projectRoot, ".test-ca");
    const caCertificatePath: string = path.join(certificateDirectory, "ca.pem");
    const caPrivateKeyPath: string = path.join(certificateDirectory, "ca-key.pem");
    await fs.mkdir(certificateDirectory, { recursive: true });

    let caCertificate: string;
    let caPrivateKey: string;
    try {
        [caCertificate, caPrivateKey] = await Promise.all([
            fs.readFile(caCertificatePath, "utf8"),
            fs.readFile(caPrivateKeyPath, "utf8")
        ]);
    } catch (error: unknown) {
        console.warn("Test CA files could not be read; generating a new CA.", error instanceof Error ? "error" : "non-error failure");
        const generatedCa: selfsigned.GenerateResult = await selfsigned.generate(
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

    const caThumbprint: string = new X509Certificate(caCertificate).fingerprint.replace(/:/g, "");
    try {
        execFileSync("certutil.exe", ["-user", "-store", "Root", caThumbprint], { stdio: "ignore" });
    } catch (error: unknown) {
        try {
            execFileSync("certutil.exe", ["-store", "Root", caThumbprint], { stdio: "ignore" });
        } catch (machineStoreError: unknown) {
            console.warn("Test CA was not found in the current-user or machine trust store; attempting current-user installation.", machineStoreError instanceof Error ? "error" : "non-error failure");
            execFileSync("certutil.exe", ["-user", "-addstore", "Root", caCertificatePath], { stdio: "ignore" });
        }
    }

    const certificate: selfsigned.GenerateResult = await selfsigned.generate(
        [{ name: "commonName", value: "127.0.0.1" }],
        {
          algorithm: "sha256",
          ca: { key: caPrivateKey, cert: caCertificate },
          extensions: [{
            name: "subjectAltName",
            altNames: [{ type: 7, ip: "127.0.0.1" }] }]
        }
    );
    const server: https.Server = https.createServer({ key: certificate.private, cert: certificate.cert }, (_request, response) => {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><html><body><p>CodAIgram HTTPS browser test</p></body></html>");
    });
    const fixturePort: number = await new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address: ReturnType<http.Server["address"]> = server.address();
            if (!address || typeof address === "string") {
                reject(new Error("HTTPS fixture did not receive a TCP port."));
                return;
            }
            resolve(address.port);
        });
    });
    const origin: string = `https://127.0.0.1:${fixturePort}`;
    return { server, origin, url: `${origin}/` };
}

async function startHttpFixture(): Promise<{ server: http.Server; url: string; origin: string }> {
    const server: http.Server = http.createServer((_request, response) => {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<!doctype html><html><body><p>CodAIgram DNS rebinding test</p></body></html>");
    });
    const fixturePort: number = await new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address: ReturnType<http.Server["address"]> = server.address();
            if (!address || typeof address === "string") {
                reject(new Error("HTTP fixture did not receive a TCP port."));
                return;
            }
            resolve(address.port);
        });
    });
    const origin: string = `http://127.0.0.1:${fixturePort}`;
    return { server, origin, url: `${origin}/` };
}

async function findChromiumExecutable(): Promise<string> {
    const candidates: (string | undefined)[] = [
        ...(process.platform === "linux" ? [process.env.CODAIGRAM_BRIDGE_CHROMIUM_PATH, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"] : []),
        ...(process.env.PROGRAMFILES ? [path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe")] : []),
        ...(process.env["PROGRAMFILES(X86)"] ? [path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe")] : [])
    ];
    for (let index: number = 0; index < candidates.length; index += 1) {
        const candidate: string | undefined = candidates[index];
        if (!candidate) continue;
        if (existsSync(candidate)) {
            return candidate;
        }
    }
    // UNTRUST-ALLOW-UNLOGGED-THROW: The top-level integration runner reports this missing-browser error once; an additional message here would duplicate the failure report.
    throw new Error("Browser integration tests require an installed Chromium browser.");
}

async function assertPortIsAvailable(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const probe: net.Server = net.createServer();
        probe.once("error", (error) => reject(new Error(`Port ${port} is already in use: ${error.message}`)));
        probe.listen(port, host, () => {
            probe.close((error) => error ? reject(error) : resolve());
        });
    });
}

async function occupyFixedPort(): Promise<net.Server> {
    const occupied: net.Server = net.createServer();
    await new Promise<void>((resolve, reject) => {
        occupied.once("error", reject);
        occupied.listen(port, host, () => resolve());
    });
    return occupied;
}

async function assertPortIsClosed(portToCheck: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const socket: net.Socket = net.createConnection({ host, port: portToCheck });
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
    const extensionDevelopmentPath: string = path.resolve(__dirname, "../..");
    const extensionTestsPath: string = path.resolve(__dirname, "suite/index.js");
    const tsRoot: string = path.resolve(projectRoot, "../..");
    const temporaryRoot: string = await fs.mkdtemp(path.join(tsRoot, "codaigram-bridge-vscode-"));
    const userDataDir: string = path.join(temporaryRoot, "user-data");
    const extensionsDir: string = path.join(temporaryRoot, "extensions");
    const portFile: string = path.join(temporaryRoot, "allocated-port.txt");
    const openedFile: string = path.join(temporaryRoot, "shutdown-client-opened.txt");
    const closedFile: string = path.join(temporaryRoot, "shutdown-client-closed.json");
    const shutdownClientPath: string = path.join(temporaryRoot, "shutdown-client.cjs");
    let occupiedPort: net.Server | undefined;
    const httpsFixture: Result<Awaited<ReturnType<typeof startHttpsFixture>>, string> = supportsHttpsFixture(process.platform) ? ok(await startHttpsFixture()) : err("HTTPS certificate tests are unsupported on Linux");
    const httpFixture: Awaited<ReturnType<typeof startHttpFixture>> = await startHttpFixture();

    try {
        await fs.writeFile(shutdownClientPath, shutdownClientScript, "utf8");
        await fs.mkdir(path.join(userDataDir, "User"), { recursive: true });
        await fs.writeFile(path.join(userDataDir, "User", "settings.json"), JSON.stringify({
          "codaigramBridge.trustedOrigins": ["https://codai.example", ...(httpsFixture.isOk() ? [httpsFixture.value.origin] : []), httpFixture.origin] }), "utf8");
        await assertPortIsAvailable();
        occupiedPort = await occupyFixedPort();
        const electronRunAsNode: string | undefined = process.env.ELECTRON_RUN_AS_NODE;
        const extensionTestsEnv: ExtensionTestsEnvT = {
          CODAIGRAM_BRIDGE_PORT_FILE: portFile,
          CODAIGRAM_BRIDGE_SCENARIO: scenario,
          CODAIGRAM_BRIDGE_HTTP_URL: httpFixture.url,
          CODAIGRAM_BRIDGE_CHROMIUM_PATH: await findChromiumExecutable(),
          CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_PATH: shutdownClientPath,
          CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_OPENED: openedFile,
          CODAIGRAM_BRIDGE_SHUTDOWN_CLIENT_CLOSED: closedFile,
          CODAIGRAM_BRIDGE_NODE_EXECUTABLE: process.execPath,
          CODAIGRAM_BRIDGE_TEMP_DIRECTORY: temporaryRoot,
          TEMP: temporaryRoot,
          TMP: temporaryRoot,
          TMPDIR: temporaryRoot,
          NODE_PATH: path.join(projectRoot, "node_modules")
        };
        if (httpsFixture.isOk()) {
            extensionTestsEnv.CODAIGRAM_BRIDGE_HTTPS_URL = httpsFixture.value.url;
        }
        delete process.env.ELECTRON_RUN_AS_NODE;
        try {
            const launchArgs: string[] = [
                "--disable-extensions",
                `--user-data-dir=${userDataDir}`,
                `--extensions-dir=${extensionsDir}`
            ];
            if (scenario === "shutdown") {
                // Open a disposable single-folder VS Code workspace. Workspace-root tests need one open folder, and this keeps them isolated from a real project.
                const workspaceFolder: string = path.join(temporaryRoot, "workspace");
                await fs.mkdir(workspaceFolder);
                launchArgs.push(workspaceFolder);
            }
            await runTests({
              version: "1.146.0",
              extensionDevelopmentPath,
              extensionTestsPath,
              extensionTestsEnv,
              launchArgs
            });
        } finally {
            if (typeof electronRunAsNode !== "string") {
                delete process.env.ELECTRON_RUN_AS_NODE;
            } else {
                process.env.ELECTRON_RUN_AS_NODE = electronRunAsNode;
            }
        }
        if (scenario === "shutdown") {
            // The client is detached from the host, so it reports socket closure through a file after the host process has exited.
            await waitForFile(closedFile, 5_000);
            const shutdownResult: { code: number } = JSON.parse(await fs.readFile(closedFile, "utf8")) as { code: number };
            if (shutdownResult.code !== 1006) {
                // UNTRUST-ALLOW-UNLOGGED-THROW: The top-level integration runner reports this failed shutdown assertion once after cleanup, avoiding duplicate error reports from this helper.
                throw new Error(`Expected abrupt WebSocket closure during extension shutdown, received code ${shutdownResult.code}.`);
            }
        }
        // The extension writes its allocated port during teardown; confirm shutdown released the listener.
        const allocatedPort: number = Number.parseInt(await fs.readFile(portFile, "utf8"), 10);
        await assertPortIsClosed(allocatedPort);
    } finally {
        await new Promise<void>((resolve) => {
            if (!occupiedPort) {
                resolve();
                return;
            }
            occupiedPort.close(() => resolve());
        });
        await fs.rm(temporaryRoot, { recursive: true, force: true });
        if (httpsFixture.isOk()) {
            await new Promise<void>((resolve) => httpsFixture.value.server.close(() => resolve()));
        }
        await new Promise<void>((resolve) => httpFixture.server.close(() => resolve()));
    }
}

async function main(): Promise<void> {
    if (!supportsHttpsFixture(process.platform)) {
        console.warn("*********************************************\n*********************************************\nHTTPS certificate integration test is unsupported on Linux and will be skipped.\n*********************************************\n*********************************************");
    }
    const selectedScenario: string | undefined = process.env.CODAIGRAM_BRIDGE_ONLY_SCENARIO;
    if (selectedScenario !== undefined) {
        if (selectedScenario !== "auth" && selectedScenario !== "concurrency" && selectedScenario !== "shutdown") {
            throw new Error(`Unknown CODAIGRAM_BRIDGE_ONLY_SCENARIO: ${selectedScenario}`);
        }
        await runScenario(selectedScenario);
        return;
    }
    await runScenario("auth");
    await runScenario("concurrency");
    await runScenario("shutdown");
}

void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});



