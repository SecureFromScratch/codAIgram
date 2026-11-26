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
    readonly configuredAgents: readonly string[];
}

export interface PromptOptions {
    readonly cwd: string;
    readonly workFolders: readonly string[];
  readonly projectName: string;
  readonly relatedFile: string;
  readonly relatedClass: string;
  readonly relatedMember: string;
}

export interface BridgeClientTimeoutOptions {
    readonly chatTimeoutMs: number;
}

export interface ScanTestCase {
    readonly group: string;
    readonly name: string;
    readonly description: string;
    readonly prompt: string;
    readonly prompts: readonly { readonly when: string; readonly text: string }[];
}

export interface ScanTestsResult {
    readonly groups: readonly string[];
    readonly cases: readonly ScanTestCase[];
}

export interface ScanClassResult {
    readonly declaration: "CLASS" | "INTERFACE";
    readonly name: string;
    readonly sourceFile: string;
    readonly modifiedAt: string;
    readonly methods: readonly unknown[];
    readonly relations: readonly unknown[];
}

export type GetCodeResult = string | readonly string[];

interface BridgeMessage {
    readonly [field: string]: unknown;
    readonly version?: unknown;
    readonly type?: unknown;
    readonly id?: unknown;
    readonly code?: unknown;
    readonly cause?: unknown;
    readonly status?: unknown;
    readonly sessionId?: unknown;
    readonly syncTimestamp?: unknown;
    readonly folders?: unknown;
    readonly response?: unknown;
    readonly result?: unknown;
}

interface PendingBridgeClientRequest {
    readonly operation: "workspace_folders" | "chat/ask" | "scan" | "code/get";
    readonly startedAt: number;
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
    private readonly pending: Map<string, PendingBridgeClientRequest> = new Map<string, PendingBridgeClientRequest>();
    private readonly disconnectListeners: Set<() => void> = new Set<() => void>();
    private disconnected: boolean = false;
    private nextId: number = 1;
    private syncTimestamp: number | undefined;
    private sessionIdValue: string | undefined;
    private sessionReady: Promise<string>;
    private resolveSession: ((sessionId: string) => void) | undefined;
    private readonly chatTimeoutMs: number;
    public constructor(connectionUrl: string, origin: string = "https://codai.example", socketFactory: BridgeSocketFactory = browserSocketFactory, private readonly timeoutMs: number = 10_000, sessionIdOrTimeoutOptions?: string | BridgeClientTimeoutOptions) {
        // UNTRUST-ALLOW-UNLOGGED-THROW: URL parsing rejects invalid caller input before any network operation starts.
        const parsed: URL = new URL(connectionUrl);
        if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
            // UNTRUST-ALLOW-UNLOGGED-THROW: Constructor validation rejects a caller-supplied URL before any connection or sensitive operation exists, so no external state needs logging.
            throw new Error("The bridge connection URL must use ws:// or wss://.");
        }
        this.socketFactory = socketFactory;
        this.connectionOrigin = origin;
        this.connectionHost = `${parsed.protocol}//${parsed.host}`;
        const sessionId: string | undefined = typeof sessionIdOrTimeoutOptions === "string" ? sessionIdOrTimeoutOptions : undefined;
        this.chatTimeoutMs = typeof sessionIdOrTimeoutOptions === "object" ? sessionIdOrTimeoutOptions.chatTimeoutMs : 150_000;
        this.sessionReady = this.createSessionPromise();
        const initialUrl: string = sessionId === undefined ? connectionUrl : this.sessionUrl(sessionId);
        this.ready = this.open(initialUrl);
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
        const response: BridgeMessage = await this.requestWorkspaceFolders();
        if (response.type !== "workspace_folders" || !Array.isArray(response.folders) || typeof response.syncTimestamp !== "number") {
            // UNTRUST-ALLOW-UNLOGGED-THROW: The malformed response is reported without exposing its payload contents; the caller receives only a stable validation error.
            throw new Error("The bridge returned an invalid workspace folder response.");
        }
        this.syncTimestamp = response.syncTimestamp;
        return response.folders as readonly WorkspaceFolder[];
    }

    public async promptAi(prompt: string, options: PromptOptions): Promise<string> {
        if (!options || typeof options.cwd !== "string" || options.cwd.length === 0) {
            // UNTRUST-ALLOW-UNLOGGED-THROW: Empty cwd is invalid local caller input and is rejected before any bridge request is sent.
            throw new Error("cwd must not be empty.");
        }
        if (!Array.isArray(options.workFolders) || options.workFolders.some((folder: unknown) => typeof folder !== "string" || folder.length === 0)) {
            // UNTRUST-ALLOW-UNLOGGED-THROW: Empty work-folder paths are invalid local caller input and are rejected before any bridge request is sent.
            throw new Error("workFolders must be a list of non-empty paths.");
        }
        if (typeof options.projectName !== "string" || options.projectName.length === 0) {
            // UNTRUST-ALLOW-UNLOGGED-THROW: A missing project name is invalid local caller input and is rejected before any bridge request is sent.
            throw new Error("projectName must not be empty.");
        }
        if (typeof options.relatedFile !== "string" || typeof options.relatedClass !== "string" || typeof options.relatedMember !== "string") {
            // UNTRUST-ALLOW-UNLOGGED-THROW: Related source context must be strings; empty strings intentionally represent absent context.
            throw new Error("relatedFile, relatedClass, and relatedMember must be strings.");
        }
        await this.ready;
        // UNTRUST-ALLOW-NULLISH: An absent timestamp means no workspace snapshot has been fetched for this connection, so the client must synchronize before sending a chat request.
        if (this.syncTimestamp === undefined) await this.getFolders();
        const syncTimestamp: number = this.currentSyncTimestamp();
        try {
            const response: BridgeMessage = await this.requestChat(prompt, syncTimestamp, options);
            if (response.type !== "chat_response" || typeof response.response !== "string") {
                this.logInvalidResponse("chat/ask", response);
                // UNTRUST-ALLOW-UNLOGGED-THROW: The malformed response details have been logged by the bridge client; callers receive a stable validation error.
                throw new Error("The bridge returned an invalid AI response.");
            }
            return response.response;
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "workspace_sync_required") {
                await this.getFolders();
                try {
                    const retry: BridgeMessage = await this.requestChat(prompt, this.currentSyncTimestamp(), options);
                    if (retry.type === "chat_response" && typeof retry.response === "string") return retry.response;
                } catch (retryError: unknown) {
                    throw retryError;
                }
            }
            // UNTRUST-ALLOW-UNLOGGED-THROW: The request error is already represented by its stable protocol code, logged above, and propagated to the API caller without payload details.
            throw error;
        }
    }

    public async scanForTests(workFolders: readonly string[]): Promise<ScanTestsResult> {
        await this.ready;
        const response: BridgeMessage = await this.requestScan("scan/tests", workFolders);
        if (response.type !== "scan_tests_response" || !isScanTestsResult(response.result)) throw new Error("The bridge returned an invalid test scan response.");
        return response.result;
    }

    public async scanForClasses(workFolders: readonly string[]): Promise<readonly ScanClassResult[]> {
        await this.ready;
        const response: BridgeMessage = await this.requestScan("scan/classes", workFolders);
        if (response.type !== "scan_classes_response" || !Array.isArray(response.result)) throw new Error("The bridge returned an invalid class scan response.");
        return response.result as readonly ScanClassResult[];
    }

    public async getCode(projectName: string, workFolders: readonly string[], filepath: string, typeName: string): Promise<GetCodeResult> {
        if (!projectName) throw new Error("projectName must not be empty.");
        if (workFolders.length === 0 || workFolders.some((folder: string) => folder.length === 0)) throw new Error("workFolders must be a non-empty list of non-empty paths.");
        if (!filepath) throw new Error("filepath must not be empty.");
        if (filepath.split(/[\\/]/u).includes("..")) throw new Error("filepath must not contain relative traversal.");
        if (!typeName) throw new Error("typeName must not be empty.");
        await this.ready;
        const response: BridgeMessage = await this.requestCode(projectName, workFolders, filepath, typeName);
        if (response.type !== "code_response" || (typeof response.code !== "string" && !(Array.isArray(response.code) && response.code.every((item: unknown) => typeof item === "string")))) throw new Error("The bridge returned an invalid code response.");
        return response.code as GetCodeResult;
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

    public async waitForSessionId(): Promise<string> {
        return this.sessionReady;
    }

    public async reconnect(): Promise<void> {
        const sessionId: string = await this.sessionReady;
        await this.close();
        this.sessionReady = this.createSessionPromise();
        this.disconnected = false;
        await this.open(this.sessionUrl(sessionId));
        await this.sessionReady;
    }

    private sessionUrl(sessionId: string): string {
        return `${this.connectionHost}/session/${encodeURIComponent(sessionId)}`;
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

    private requestChat(prompt: string, syncTimestamp: number, options: PromptOptions): Promise<BridgeMessage> {
        const id: string = `client-${this.nextId++}`;
        const request: string = JSON.stringify({
            version: 1,
            type: "chat/ask",
            id,
            prompt,
            syncTimestamp,
            cwd: options.cwd,
            workFolders: options.workFolders,
            projectName: options.projectName,
            relatedFile: options.relatedFile,
            relatedClass: options.relatedClass,
            relatedMember: options.relatedMember
        });
        return this.sendRequest(id, "chat/ask", request, this.chatTimeoutMs);
    }

    private requestWorkspaceFolders(): Promise<BridgeMessage> {
        const id: string = `client-${this.nextId++}`;
        const request: string = JSON.stringify({ version: 1, type: "workspace_folders", id });
        return this.sendRequest(id, "workspace_folders", request);
    }

    private requestScan(type: "scan/tests" | "scan/classes", workFolders: readonly string[]): Promise<BridgeMessage> {
        const id: string = `client-${this.nextId++}`;
        const request: string = JSON.stringify({ version: 1, type, id, workFolders });
        return this.sendRequest(id, "scan", request);
    }

    private requestCode(projectName: string, workFolders: readonly string[], filepath: string, typeName: string): Promise<BridgeMessage> {
        const id: string = `client-${this.nextId++}`;
        const request: string = JSON.stringify({ version: 1, type: "code/get", id, projectName, workFolders, filepath, typeName });
        return this.sendRequest(id, "code/get", request);
    }

    private sendRequest(id: string, operation: "workspace_folders" | "chat/ask" | "scan" | "code/get", text: string, timeoutMs: number = this.timeoutMs): Promise<BridgeMessage> {
        return new Promise<BridgeMessage>((resolve, reject) => {
            const startedAt: number = Date.now();
            const timeout: ReturnType<typeof setTimeout> = setTimeout(() => {
                const pending: PendingBridgeClientRequest | undefined = this.pending.get(id);
                if (!pending) return;
                this.pending.delete(id);
                this.logRequestFailure(operation, id, "bridge_response_timeout", Date.now() - startedAt);
                pending.reject(new Error("The bridge request timed out."));
            }, timeoutMs);
            this.pending.set(id, { operation, startedAt, resolve, reject, timeout });
            console.info(`[${new Date().toISOString()}] Sending request to VS Code bridge.`, {
                operation,
                requestId: id,
                endpoint: this.connectionHost,
                socketReadyState: this.socket.readyState
            });
            this.socket.send(text, (error) => {
                if (error) {
                    clearTimeout(timeout);
                    this.pending.delete(id);
                    this.logRequestFailure(operation, id, "websocket_send_failed", Date.now() - startedAt);
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
        const pending: PendingBridgeClientRequest | undefined = this.pending.get(message.id);
        if (!pending) return;
        if (pending.operation === "chat/ask" && (message.type === "chat_event" || message.type === "chat_delta")) {
            console.info(`[${new Date().toISOString()}] VS Code bridge chat progress received.`, {
                operation: pending.operation,
                requestId: message.id,
                endpoint: this.connectionHost,
                event: message.type === "chat_event" && typeof message.event === "string" ? message.event : message.type,
                dataJson: JSON.stringify(message.type === "chat_event" ? message.data : message.delta)
            });
            return;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(message.id);
        if (message.type === "error") {
            const errorCode: string = typeof message.code === "string" ? message.code : "bridge_request_failed";
            const errorCause: string = typeof message.cause === "string" ? message.cause : "not provided";
            this.logRequestFailure(pending.operation, message.id, `${errorCode}; cause=${errorCause}`, Date.now() - pending.startedAt, message);
            pending.reject(new Error(errorCause === "not provided" ? errorCode : `${errorCode} (${errorCause})`));
        } else {
            console.info(`[${new Date().toISOString()}] VS Code bridge response received.`, {
                operation: pending.operation,
                requestId: message.id,
                endpoint: this.connectionHost,
                durationMs: Date.now() - pending.startedAt
            });
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

    private logRequestFailure(operation: "workspace_folders" | "chat/ask" | "scan" | "code/get", requestId: string, errorCode: string, durationMs: number, response?: BridgeMessage): void {
        console.error(`[${new Date().toISOString()}] VS Code bridge request failed.`, {
            operation,
            requestId,
            endpoint: this.connectionHost,
            errorCode,
            durationMs,
            socketReadyState: this.socket.readyState,
            ...(response === undefined ? {} : {
                status: response.status ?? "not provided",
                responseJson: JSON.stringify(response)
            })
        });
    }

    private logInvalidResponse(operation: "chat/ask", response: BridgeMessage): void {
        console.error(`[${new Date().toISOString()}] VS Code bridge returned an invalid response.`, {
            operation,
            requestId: typeof response.id === "string" ? response.id : "not provided",
            endpoint: this.connectionHost,
            status: response.status ?? "not provided",
            responseJson: JSON.stringify(response)
        });
    }
}

function isScanTestsResult(value: unknown): value is ScanTestsResult {
    return typeof value === "object" && value !== null && "groups" in value && Array.isArray(value.groups) && "cases" in value && Array.isArray(value.cases);
}

export function createBridgeClient(connectionUrl: string, origin?: string, socketFactory?: BridgeSocketFactory): BridgeClient {
    return new BridgeClient(connectionUrl, origin, socketFactory);
}

export function createBridgeClientForSession(connectionUrl: string, sessionId: string, origin?: string, socketFactory?: BridgeSocketFactory): BridgeClient {
    if (sessionId.length === 0) {
        // UNTRUST-ALLOW-UNLOGGED-THROW: An empty session identifier is rejected as invalid local caller input before creating a socket or sending any bridge request.
        throw new Error("A persistent bridge session requires a session ID.");
    }
    return new BridgeClient(connectionUrl, origin, socketFactory, 10_000, sessionId);
}
