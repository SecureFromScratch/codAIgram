import * as assert from "node:assert";
import { EventEmitter } from "node:events";
import type * as http from "node:http";
import { startLoopbackListener } from "../../src/listenerStartup";

export const TEST_CASE_METADATA = {
  title: "rejects startup when the HTTP listener cannot bind",
  prompt: {
    availability: "unavailable",
    reason: "The test predates prompt provenance.",
    history: []
  }
};

export function registerListenerStartupCase(): void {
    test(TEST_CASE_METADATA.title, async () => {
        const server = new EventEmitter() as EventEmitter & Pick<http.Server, "listen" | "address">;
        // UNTRUST-ALLOW-NULLISH: Node Server.address returns null before a listener is bound; this fake deliberately reproduces that external API state while exercising startup failure.
        server.address = () => null;
        server.listen = (() => {
            process.nextTick(() => server.emit("error", new Error("EACCES: listener could not bind.")));
            return server;
        }) as http.Server["listen"];

        await assert.rejects(startLoopbackListener(server as http.Server), /EACCES/);
    });
}
