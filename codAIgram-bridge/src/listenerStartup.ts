import type { AddressInfo } from "node:net";
import type * as http from "node:http";

const host: "127.0.0.1" = "127.0.0.1";

export function startLoopbackListener(server: http.Server): Promise<AddressInfo> {
    return new Promise((resolve, reject) => {
        const onError = (error: Error): void => {
            server.removeListener("listening", onListening);
            server.removeListener("error", onError);
            reject(new Error(`The CodAIgram Bridge listener failed to start: ${error.message}`));
        };
        const onListening = (): void => {
            server.removeListener("error", onError);
            const address = server.address();
            if (!address || typeof address === "string" || address.address !== host ||
                !Number.isInteger(address.port) || address.port < 1 || address.port > 65_535) {
                reject(new Error("The CodAIgram Bridge listener returned an invalid listening address."));
                return;
            }
            resolve(address);
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(0, host);
    });
}
