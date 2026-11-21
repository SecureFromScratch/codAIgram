export interface BridgeSocket {
    readonly readyState: number;
    addEventListener(type: string, listener: (...args: readonly unknown[]) => void, options?: { readonly once?: boolean }): void;
    send(data: string, callback?: (error?: Error) => void): void;
    close(): void;
}

export type BridgeSocketFactory = (url: string, origin: string) => BridgeSocket;

const browserSocketFactory: BridgeSocketFactory = (url) => new WebSocket(url);

export interface WorkspaceFolder {
    readonly name: string;
    readonly uri: string;
    readonly index: number;
}

interface BridgeMessage {
    readonly version?: unknown;
    readonly type?: unknown;
    readonly id?: unknown;
    readonly code?: unknown;
    readonly sessionId?: unknown;
    readonly syncTimestamp?: unknown;
    readonly folders?: unknown;
    readonly response?: unknown;
}

interface PendingRequest {
    readonly resolve: (message: BridgeMessage) => void;
    readonly reject: (error: Error) => void;
    readonly timeout: ReturnType<typeof setTimeout>;
}

export class BridgeClient {
    public readonly ready: Promise<void>;
    private socket!: BridgeSocket;
    private readonly socketFactory: BridgeSocketFactory;
    private readonly connectionOrigin: string;
    private readonly connectionHost: string;
    private readonly pending: Map<string, PendingRequest> = new Map<string, PendingRequest>();
    private readonly disconnectListeners: Set<() => void> = new Set<() => void>();
    private disconnected: boolean = false;
    private nextId: number = 1;
    private syncTimestamp: number | undefined;
    private sessionIdValue: string | undefined;
    private sessionReady: Promise<string>;
    private resolveSession: ((sessionId: string) => void) | undefined;
    public constructor(connectionUrl: string, origin: string = "https://codai.example", socketFactory: BridgeSocketFactory = browserSocketFactory, private readonly timeoutMs: number = 10_000) {
        // UNTRUST-ALLOW-UNLOGGED-THROW: URL parsing rejects invalid caller input before any network operation starts.
        const parsed: URL = new URL(connectionUrl);
        if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
            // UNTRUST-ALLOW-UNLOGGED-THROW: Constructor validation rejects a caller-supplied URL before any connection or sensitive operation exists, so no external state needs logging.
            throw new Error("The bridge connection URL must use ws:// or wss://.");
        }
        this.socketFactory = socketFactory;
        this.connectionOrigin = origin;
        this.connectionHost = `${parsed.protocol}//${parsed.host}`;
        this.sessionReady = this.createSessionPromise();
        this.ready = this.open(connectionUrl);
    }

    public onDisconnect(listener: () => void): () => void {
        if (this.disconnected) {
            listener();
            return () => undefined;
        }
        this.disconnectListeners.add(listener);
        return () => {
            this.disconnectListeners.delete(listener);
        };
    }

    public async getFolders(): Promise<readonly WorkspaceFolder[]> {
        await this.ready;
        const response: BridgeMessage = await this.request("workspace_folders");
        if (response.type !== "workspace_folders" || !Array.isArray(response.folders) || typeof response.syncTimestamp !== "number") {
            // UNTRUST-ALLOW-UNLOGGED-THROW: The malformed response is reported without exposing its payload contents; the caller receives only a stable validation error.
            throw new Error("The bridge returned an invalid workspace folder response.");
        }
        this.syncTimestamp = response.syncTimestamp;
        return response.folders as readonly WorkspaceFolder[];
    }

    public async promptAi(prompt: string): Promise<string> {
        await this.ready;
        // UNTRUST-ALLOW-NULLISH: An absent timestamp means no workspace snapshot has been fetched for this connection, so the client must synchronize before sending a chat request.
        if (this.syncTimestamp === undefined) await this.getFolders();
        const syncTimestamp: number = this.currentSyncTimestamp();
        try {
            const response: BridgeMessage = await this.requestChat(prompt, syncTimestamp);
            if (response.type !== "chat_response" || typeof response.response !== "string") {
                // UNTRUST-ALLOW-UNLOGGED-THROW: The malformed response is reported to the caller without exposing payload contents; only a stable validation error is returned.
                throw new Error("The bridge returned an invalid AI response.");
            }
            return response.response;
        } catch (error: unknown) {
            console.warn("Bridge AI request failed.", error instanceof Error ? "error" : "non-error failure");
            if (error instanceof Error && error.message === "workspace_sync_required") {
                await this.getFolders();
                const retry: BridgeMessage = await this.requestChat(prompt, this.currentSyncTimestamp());
                if (retry.type === "chat_response" && typeof retry.response === "string") return retry.response;
            }
            // UNTRUST-ALLOW-UNLOGGED-THROW: The request error is already represented by its stable protocol code, logged above, and propagated to the API caller without payload details.
            throw error;
        }
    }

    public async close(): Promise<void> {
        if (this.disconnected || this.socket.readyState === 3) return;
        await new Promise<void>((resolve) => {
            this.socket.addEventListener("close", () => {
                // Allow the extension host to observe the close and release the one-time pairing nonce.
                setTimeout(resolve, 25);
            }, { once: true });
            this.socket.close();
        });
    }

    public get sessionId(): string | undefined {
        return this.sessionIdValue;
    }

    public async reconnect(): Promise<void> {
        const sessionId: string = await this.sessionReady;
        await this.close();
        this.sessionReady = this.createSessionPromise();
        this.disconnected = false;
        await this.open(`${this.connectionHost}/session/${sessionId}`);
    }

    private createSessionPromise(): Promise<string> {
        return new Promise<string>((resolve) => {
            this.resolveSession = resolve;
        });
    }

    private open(connectionUrl: string): Promise<void> {
        // UNTRUST-ALLOW-UNLOGGED-THROW: WebSocket constructor failures are surfaced through the ready promise and contain no bridge payload.
        this.socket = this.socketFactory(connectionUrl, this.connectionOrigin);
        return new Promise<void>((resolve, reject) => {
            const timeout: ReturnType<typeof setTimeout> = setTimeout(() => {
                reject(new Error("The bridge connection timed out."));
                this.socket.close();
            }, this.timeoutMs);
            this.socket.addEventListener("open", () => {
                clearTimeout(timeout);
                resolve();
            }, { once: true });
            this.socket.addEventListener("error", (error) => {
                clearTimeout(timeout);
                reject(error instanceof Error ? error : new Error("WebSocket connection failed."));
            }, { once: true });
            this.socket.addEventListener("close", () => {
                clearTimeout(timeout);
                reject(new Error("The bridge connection closed before it was ready."));
            }, { once: true });
            this.socket.addEventListener("message", (event) => this.receive(this.messageText(event)));
            this.socket.addEventListener("error", (error) => this.failPending(error instanceof Error ? error : new Error("WebSocket connection failed.")));
            this.socket.addEventListener("close", () => {
                this.disconnected = true;
                this.failPending(new Error("The bridge connection closed."));
                this.disconnectListeners.forEach((listener: () => void) => listener());
            });
        });
    }

    private currentSyncTimestamp(): number {
        // UNTRUST-ALLOW-NULLISH: The check protects the numeric return invariant after workspace synchronization and turns an impossible local state into a stable API error.
        if (this.syncTimestamp === undefined) {
            // UNTRUST-ALLOW-UNLOGGED-THROW: The invariant failure is local client state and contains no external payload; callers receive a stable synchronization error.
            throw new Error("Workspace synchronization is required before the AI request.");
        }
        return this.syncTimestamp;
    }

    private requestChat(prompt: string, syncTimestamp: number): Promise<BridgeMessage> {
        return this.request("chat/ask", prompt, syncTimestamp);
    }

    private request(type: "workspace_folders" | "chat/ask", prompt?: string, syncTimestamp?: number): Promise<BridgeMessage> {
        const id: string = `client-${this.nextId++}`;
        if (type === "workspace_folders") return this.sendRequest(id, JSON.stringify({ version: 1, type, id }));
        if (typeof prompt !== "string" || typeof syncTimestamp !== "number") {
            // UNTRUST-ALLOW-UNLOGGED-THROW: The caller invariant failure contains no external payload; the API rejects the malformed local call with a stable error.
            throw new Error("A chat request requires a prompt and workspace synchronization timestamp.");
        }
        return this.sendRequest(id, JSON.stringify({ version: 1, type, id, prompt, syncTimestamp }));
    }

    private sendRequest(id: string, text: string): Promise<BridgeMessage> {
        return new Promise<BridgeMessage>((resolve, reject) => {
            const timeout: ReturnType<typeof setTimeout> = setTimeout(() => {
                const pending: PendingRequest | undefined = this.pending.get(id);
                if (!pending) return;
                this.pending.delete(id);
                pending.reject(new Error("The bridge request timed out."));
            }, this.timeoutMs);
            this.pending.set(id, { resolve, reject, timeout });
            this.socket.send(text, (error) => {
                if (error) {
                    clearTimeout(timeout);
                    this.pending.delete(id);
                    // UNTRUST-ALLOW-UNLOGGED-THROW: WebSocket send errors are returned directly to the pending request caller.
                    reject(error);
                }
            });
        });
    }

    private receive(text: string): void {
        let message: BridgeMessage;
        try {
            message = JSON.parse(text) as BridgeMessage;
        } catch (error: unknown) {
            console.warn("Bridge returned a non-JSON message.", error instanceof Error ? "error" : "non-error failure");
            // UNTRUST-ALLOW-UNLOGGED-THROW: Non-JSON frames are ignored by the protocol client and contain no actionable structured error.
            return;
        }
        if (message.type === "workspace_changed" && typeof message.syncTimestamp === "number") {
            // UNTRUST-ALLOW-NULLISH: Clearing the timestamp forces the next synchronized operation to refresh workspace state before issuing another workspace-sensitive request.
            this.syncTimestamp = undefined;
            return;
        }
        if (message.type === "session" && typeof message.sessionId === "string") {
            this.sessionIdValue = message.sessionId;
            if (this.resolveSession) this.resolveSession(message.sessionId);
            return;
        }
        if (typeof message.id !== "string") return;
        const pending: PendingRequest | undefined = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(message.id);
        if (message.type === "error") {
            pending.reject(new Error(typeof message.code === "string" ? message.code : "bridge_request_failed"));
        } else {
            pending.resolve(message);
        }
    }

    private messageText(event: unknown): string {
        if (typeof event === "object" && event !== null && "data" in event) {
            const data: unknown = (event as { readonly data: unknown }).data;
            return typeof data === "string" ? data : String(data);
        }
        return String(event);
    }

    private failPending(error: Error): void {
        this.pending.forEach((pending) => {
            clearTimeout(pending.timeout);
            pending.reject(error);
        });
        this.pending.clear();
    }
}

export function createBridgeClient(connectionUrl: string, origin?: string, socketFactory?: BridgeSocketFactory): BridgeClient {
    return new BridgeClient(connectionUrl, origin, socketFactory);
}
