import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function runLiveVisualHost(): Promise<void> {
    const coordinationDirectory: string | undefined = process.env.CODAIGRAM_LIVE_HOST_DIRECTORY;
    if (!coordinationDirectory) {
        console.error("Live visual host coordination directory is required.");
        process.exitCode = 1;
        return;
    }
    const codaigramRoot: string = path.resolve(__dirname, "../../../");
    const extensionDevelopmentPath: string = path.resolve(__dirname, "../..");
    const extensionTestsPath: string = path.resolve(__dirname, "suite/liveVisualHostTest.js");
    const workspacePath: string = path.join(codaigramRoot, "scanner", "mock-testproject");
    const userDataPath: string = path.join(coordinationDirectory, "user-data");
    const extensionsPath: string = path.join(coordinationDirectory, "extensions");
    const readyFilePath: string = path.join(coordinationDirectory, "bridge-ready.json");
    const stopFilePath: string = path.join(coordinationDirectory, "stop-host");
    await fs.mkdir(path.join(userDataPath, "User"), { recursive: true });
    await fs.mkdir(extensionsPath, { recursive: true });
    await fs.writeFile(
        path.join(userDataPath, "User", "settings.json"),
        JSON.stringify({
          "codaigramBridge.trustedOrigins": ["http://127.0.0.1:41731"],
          "security.workspace.trust.enabled": false
        }),
        "utf8"
    );
    const extensionTestsEnv: NodeJS.ProcessEnv = {
      CODAIGRAM_LIVE_HOST_READY_FILE: readyFilePath,
      CODAIGRAM_LIVE_HOST_STOP_FILE: stopFilePath,
      CODAIGRAM_LIVE_PROJECT_PATH: workspacePath
    };
    const launchArgs: string[] = [
        "--new-window",
        "--disable-extensions",
        `--user-data-dir=${userDataPath}`,
        `--extensions-dir=${extensionsPath}`,
        workspacePath
    ];
    const electronRunAsNode: string | undefined = process.env.ELECTRON_RUN_AS_NODE;
    delete process.env.ELECTRON_RUN_AS_NODE;
    try {
        const testOptions: Parameters<typeof runTests>[0] = {
          version: "1.146.0",
          extensionDevelopmentPath,
          extensionTestsPath,
          extensionTestsEnv,
          launchArgs
        };
        await runTests(testOptions);
    } finally {
        if (typeof electronRunAsNode !== "string") delete process.env.ELECTRON_RUN_AS_NODE;
        else process.env.ELECTRON_RUN_AS_NODE = electronRunAsNode;
    }
}

void runLiveVisualHost().catch((error: unknown) => {
    // UNTRUST-ALLOW-UNLOGGED-THROW: The runner records the full failure in stderr and communicates it to the parent process through its nonzero exit code.
    console.error("Isolated VS Code live visual host failed.", error);
    process.exitCode = 1;
});
