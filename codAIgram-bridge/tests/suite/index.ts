import * as path from "node:path";
import Mocha from "mocha";

export function run(): Promise<void> {
    const mocha = new Mocha({
        color: true,
        ui: "tdd",
        timeout: 10_000
    });
    mocha.addFile(path.resolve(__dirname, "extension.test.js"));
    mocha.addFile(path.resolve(__dirname, "connectionStatus.test.js"));
    mocha.addFile(path.resolve(__dirname, "listenerStartup.test.js"));

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

