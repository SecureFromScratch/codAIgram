import * as assert from "node:assert";
import { EventEmitter } from "node:events";
import type * as http from "node:http";
import { startLoopbackListener } from "../../src/listenerStartup";

suite("CodAIgram Bridge listener startup", () => {
    test("rejects startup when the HTTP listener cannot bind", async () => {
        const server = new EventEmitter() as EventEmitter & Pick<http.Server, "listen" | "address">;
        server.address = () => null;
        server.listen = (() => {
            process.nextTick(() => server.emit("error", new Error("EACCES: listener could not bind.")));
            return server;
        }) as http.Server["listen"];

        await assert.rejects(startLoopbackListener(server as http.Server), /EACCES/);
    });
});

