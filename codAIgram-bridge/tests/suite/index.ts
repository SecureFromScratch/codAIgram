import * as path from "node:path";
import Mocha from "mocha";

export function run(): Promise<void> {
    const mocha: Mocha = new Mocha({ color: true, ui: "tdd", timeout: 10_000 });
    mocha.addFile(path.resolve(__dirname, "extension.test.js"));
    mocha.addFile(path.resolve(__dirname, "connectionStatus.test.js"));
    mocha.addFile(path.resolve(__dirname, "listenerStartup.test.js"));
    mocha.addFile(path.resolve(__dirname, "httpsSupport.test.js"));
    mocha.addFile(path.resolve(__dirname, "editorWaits.test.js"));
    mocha.addFile(path.resolve(__dirname, "workspaceRoot.test.js"));
    mocha.addFile(path.resolve(__dirname, "workingDirectory.test.js"));
    mocha.addFile(path.resolve(__dirname, "launchDirectory.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexDiscovery.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexLaunchSpec.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexSpawn.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexStop.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexInitialize.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexLifecycle.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexThreads.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexThreadStorage.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexHealth.test.js"));
    mocha.addFile(path.resolve(__dirname, "codexRpc.test.js"));
    mocha.addFile(path.resolve(__dirname, "workspaceSync.test.js"));

    return new Promise((resolve, reject) => {
        mocha.run((failures) => {
            if (failures === 0) {
                resolve();
                return;
            }
            reject(new Error(`${failures} integration test(s) failed.`));
        });
    });
}
