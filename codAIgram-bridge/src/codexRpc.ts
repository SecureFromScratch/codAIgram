import * as readline from "node:readline";
import type { Readable, Writable } from "node:stream";
import { err, ok, Result } from "neverthrow";

export interface CodexNotification {
    readonly method: string;
    readonly params?: unknown;
}

export interface CodexNotificationHandler {
    (notification: CodexNotification): void;
}

interface PendingCodexRpcRequest {
    readonly resolve: (result: Result<unknown, string>) => void;
}

interface JsonRpcRecord {
    readonly id?: unknown;
    readonly result?: unknown;
    readonly error?: unknown;
    readonly method?: unknown;
    readonly params?: unknown;
}

export class CodexJsonRpcClient {
    private nextId: number = 2;
    private readonly pending: Map<number, PendingCodexRpcRequest> = new Map<number, PendingCodexRpcRequest>();
    private readonly handlers: Set<CodexNotificationHandler> = new Set<CodexNotificationHandler>();
    private readonly lines: readline.Interface;
    private state: "open" | "closed" = "open";

    public constructor(private readonly stdin: Writable, stdout: Readable) {
        this.lines = readline.createInterface({ input: stdout });
        this.lines.on("line", (line: string) => this.receive(line));
        this.lines.once("close", () => this.closePending());
    }

    public onNotification(handler: CodexNotificationHandler): () => boolean {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    public request(method: string, params: unknown): Promise<Result<unknown, string>> {
        if (this.state === "closed") return Promise.resolve(err("process_closed"));
        const id: number = this.nextId++;
        return new Promise((resolve) => {
            this.pending.set(id, { resolve });
            try {
                const request: string = `${JSON.stringify({ id, method, params })}\n`;
                const written: boolean = this.stdin.write(request);
                if (!written) {
                    this.pending.delete(id);
                    resolve(err("write_failed"));
                }
            } catch (error: unknown) {
                console.warn("Codex JSON-RPC write failed.", error);
                this.pending.delete(id);
                resolve(err("write_failed"));
            }
        });
    }

    public dispose(): void {
        this.state = "closed";
        this.lines.close();
        this.closePending();
    }

    private receive(line: string): void {
        let message: unknown;
        try {
            message = JSON.parse(line) as unknown;
        } catch (error: unknown) {
            console.warn("Codex JSON-RPC response parsing failed.", error);
            return;
        }
        if (!message || typeof message !== "object") return;
        const record: JsonRpcRecord = message as JsonRpcRecord;
        if (typeof record.id === "number") {
            const pending: PendingCodexRpcRequest | undefined = this.pending.get(record.id);
            if (!pending) return;
            this.pending.delete(record.id);
            pending.resolve("error" in record ? err("request_failed") : ok(record.result));
            return;
        }
        if (typeof record.method === "string") {
            // UNTRUST-ALLOW-NULLISH: A notification without params is a valid JSON-RPC notification; this fixed-shape branch preserves that absence without inventing protocol data.
            const notification: CodexNotification = record.params === undefined
                ? { method: record.method }
                : { method: record.method, params: record.params };
            this.handlers.forEach((handler) => handler(notification));
        }
    }

    private closePending(): void {
        this.state = "closed";
        this.pending.forEach((pending: PendingCodexRpcRequest) => pending.resolve(err("process_closed")));
        this.pending.clear();
    }
}
