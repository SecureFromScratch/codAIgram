import * as path from "node:path";
import Mocha from "mocha";

export function run(): Promise<void> {
    const mocha: Mocha = new Mocha({ color: true, ui: "tdd", timeout: 190_000 });
    mocha.addFile(path.resolve(__dirname, "liveVisualHost.case.js"));
    return new Promise((resolve, reject) => {
        mocha.run((failures) => {
            if (failures === 0) {
                resolve();
                return;
            }
            reject(new Error(`${failures} live visual VS Code host test(s) failed.`));
        });
    });
}
