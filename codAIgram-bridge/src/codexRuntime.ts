import type { ChildProcess } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { err, ok, Result } from "neverthrow";
import { discoverCodexExecutable } from "./codexDiscovery";
import type { CodexDiscoveryErrorT } from "./codexDiscovery";
import { resolveLaunchDirectory, resolveLaunchDirectoryFor } from "./launchDirectory";
import type { LaunchDirectoryErrorT } from "./launchDirectory";
import { startCodexAppServer } from "./codexLifecycle";
import type { CodexClientInfo, CodexInitializeErrorT } from "./codexInitialize";
import { CodexProcessHealth } from "./codexHealth";
import { stopCodexAppServer } from "./codexStop";
import { CodexJsonRpcClient } from "./codexRpc";
import type { CodexNotification } from "./codexRpc";
import { normalizeCodexWorkspaceConfiguration } from "./codexWorkspace";
import type { CodexWorkspaceConfiguration } from "./codexWorkspace";

interface DeltaParams {
  readonly threadId: unknown;
  readonly turnId: unknown;
  readonly delta: unknown;
}

interface CompletionParams {
  readonly threadId: unknown;
  readonly turn: unknown;
}

interface CompletedTurn {
  readonly id: unknown;
  readonly status: unknown;
}

export type CodexRuntimeErrorT = CodexDiscoveryErrorT | LaunchDirectoryErrorT | CodexInitializeErrorT | "spawn_failed" | "unsupported_launcher" | "invalid_executable_path" | "invalid_working_directory" | "missing_stream" | "already_running" | "not_running" | "request_failed" | "thread_start_failed" | "thread_start_invalid_response" | "turn_start_failed" | "turn_start_invalid_response" | "turn_failed" | "invalid_response" | "turn_timeout";

export interface CodexPromptOptions {
  readonly cwd?: string;
  readonly workFolders?: readonly string[];
}

export class CodexRuntime {
  public constructor(private readonly additionalCodexSearchDirectories: readonly string[] = []) {}

  private child: ChildProcess | undefined;
  private health: CodexProcessHealth | undefined;
  private client: CodexJsonRpcClient | undefined;
  private workingDirectory: string | undefined;
  private threadId: string | undefined;
  private threadWorkspaceConfiguration: CodexWorkspaceConfiguration | undefined;
  private turnId: string | undefined;

  public async start(clientInfo: CodexClientInfo, options: CodexPromptOptions = {}): Promise<Result<void, CodexRuntimeErrorT>> {
    if (this.child) return err("already_running");
    const directory: Awaited<ReturnType<typeof resolveLaunchDirectory>> = typeof options.cwd === "string" ? await resolveLaunchDirectoryFor(options.cwd) : await resolveLaunchDirectory();
    if (directory.isErr()) return err(directory.error);
    const executable: Awaited<ReturnType<typeof discoverCodexExecutable>> = await discoverCodexExecutable(this.additionalCodexSearchDirectories);
    if (executable.isErr()) return err(executable.error);
    const started: Awaited<ReturnType<typeof startCodexAppServer>> = await startCodexAppServer(executable.value, directory.value, clientInfo);
    if (started.isErr()) return err(started.error);
    this.child = started.value;
    // UNTRUST-ALLOW-NULLISH: The lifecycle helper already validated both streams; this boundary narrows Node's nullable ChildProcess fields for the JSONL client.
    const stdin: Writable = started.value.stdin as Writable;
    // UNTRUST-ALLOW-NULLISH: The lifecycle helper already validated both streams; this boundary narrows Node's nullable ChildProcess fields for the JSONL client.
    const stdout: Readable = started.value.stdout as Readable;
    if (!stdin || !stdout) {
      await stopCodexAppServer(started.value);
      // UNTRUST-ALLOW-NULLISH: A child lacking streams cannot support the protocol and is cleared before returning the typed startup error, preventing later calls from reusing a partial process.
      this.child = undefined;
      return err("missing_stream");
    }
    this.client = new CodexJsonRpcClient(stdin, stdout);
    this.workingDirectory = directory.value;
    // UNTRUST-ALLOW-NULLISH: The runtime stores the active child immediately after the startup handshake succeeds and no concurrent callback can clear it before this synchronous assignment.
    const activeChild: ChildProcess = this.child;
    this.health = new CodexProcessHealth(activeChild, () => {
      // UNTRUST-ALLOW-NULLISH: Health callbacks run while the runtime owns this monitor and may clear it only once.
      this.health?.dispose();
      // UNTRUST-ALLOW-NULLISH: Clearing the health monitor after reporting an unexpected exit makes the runtime unavailable until an explicit new start.
      this.health = undefined;
      // UNTRUST-ALLOW-NULLISH: Clearing the child handle after reporting an unexpected exit prevents stale process reuse and allows a later explicit restart.
      this.child = undefined;
    });
    return ok(void 0);
  }

  public async stop(): Promise<boolean> {
    const child: ChildProcess | undefined = this.child;
    if (!child) return true;
    // UNTRUST-ALLOW-NULLISH: This health monitor exists whenever a running child is stored and is cleared together with it.
    this.health?.markIntentionalShutdown();
    this.health?.dispose();
    // UNTRUST-ALLOW-NULLISH: Intentional stop clears the monitor before releasing the child so later exit events cannot be reported as unexpected process failures during normal extension shutdown.
    this.health = undefined;
    // UNTRUST-ALLOW-NULLISH: The client exists exactly when the child completed initialization; optional disposal safely handles a partially initialized stop.
    this.client?.dispose();
    // UNTRUST-ALLOW-NULLISH: Clearing the protocol client after shutdown prevents reuse of streams owned by the terminated child process and ensures a later activation creates a fresh JSONL transport.
    this.client = undefined;
    // UNTRUST-ALLOW-NULLISH: Thread state is activation-owned and must be cleared after stopping its process so no conversation can accidentally target a terminated child or reuse its prior workspace authorization.
    this.threadId = undefined;
    // UNTRUST-ALLOW-NULLISH: A stopped runtime discards its active thread configuration so the next start cannot reuse folder authorization from the previous process or expose stale selected paths.
    this.threadWorkspaceConfiguration = undefined;
    // UNTRUST-ALLOW-NULLISH: A stopped process cannot have an active turn, so clearing this identifier prevents cancellation from targeting stale Codex state.
    this.turnId = undefined;
    // UNTRUST-ALLOW-NULLISH: The working directory is only valid while the corresponding child process is running and must not be reused after intentional shutdown.
    this.workingDirectory = undefined;
    // UNTRUST-ALLOW-NULLISH: Intentional stop clears the child handle before awaiting termination so a concurrent stop cannot issue a second signal or retain a process that is already being terminated.
    this.child = undefined;
    return stopCodexAppServer(child);
  }

  public async restart(clientInfo: CodexClientInfo): Promise<Result<void, CodexRuntimeErrorT>> {
    await this.stop();
    return this.start(clientInfo);
  }

  public async ask(prompt: string, onDelta?: (delta: string) => void, onEvent?: (notification: CodexNotification) => void, options: CodexPromptOptions = {}): Promise<Result<string, CodexRuntimeErrorT>> {
    const client: CodexJsonRpcClient | undefined = this.client;
    const cwd: string | undefined = this.workingDirectory;
    if (!client || !cwd) return err("not_running");
    const requestedCwd: string = typeof options.cwd === "string" ? options.cwd : cwd;
    const validatedCwd: Awaited<ReturnType<typeof resolveLaunchDirectoryFor>> = await resolveLaunchDirectoryFor(requestedCwd);
    if (validatedCwd.isErr()) return err(validatedCwd.error);
    const requestedWorkFolders: readonly string[] = Array.isArray(options.workFolders) ? options.workFolders : [];
    const validatedWorkFolders: string[] = [];
    for (let folderIndex: number = 0; folderIndex < requestedWorkFolders.length; folderIndex++) {
      const folder: string = requestedWorkFolders[folderIndex] as string;
      if (folder === validatedCwd.value) continue;
      const validatedFolder: Awaited<ReturnType<typeof resolveLaunchDirectoryFor>> = await resolveLaunchDirectoryFor(folder);
      if (validatedFolder.isErr()) return err(validatedFolder.error);
      validatedWorkFolders.push(validatedFolder.value);
    }
    const configuration: CodexWorkspaceConfiguration = normalizeCodexWorkspaceConfiguration(validatedCwd.value, validatedWorkFolders);
    const workspaceConfigurationChanged: boolean = !workspaceConfigurationsMatch(this.threadWorkspaceConfiguration, configuration);
    if (workspaceConfigurationChanged) {
      // UNTRUST-ALLOW-NULLISH: Changing selected folder scope requires a new Codex thread because Codex records cwd and workFolders on thread/start; the replacement request below creates a thread with the newly authorized paths.
      this.threadId = undefined;
      // UNTRUST-ALLOW-NULLISH: The saved folder scope belongs to the thread being discarded and must not authorize the replacement thread; its new configuration is saved only after thread/start succeeds.
      this.threadWorkspaceConfiguration = undefined;
    }
    if (!this.threadId) {
      const threadParams: object = {
        cwd: configuration.cwd,
        workFolders: configuration.workFolders,
        approvalPolicy: "on-request",
        sandbox: "read-only"
      };
      const started: Result<unknown, string> = await client.request("thread/start", threadParams);
      if (started.isErr()) return err("thread_start_failed");
      const threadId: string | undefined = extractThreadId(started.value);
      if (!threadId) return err("thread_start_invalid_response");
      this.threadId = threadId;
      this.threadWorkspaceConfiguration = configuration;
    }
    const turn: Result<unknown, string> = await client.request("turn/start", {
      threadId: this.threadId,
      input: [{ type: "text", text: prompt }]
    });
    if (turn.isErr()) return err("turn_start_failed");
    const turnId: string | undefined = extractTurnId(turn.value);
    if (!turnId) return err("turn_start_invalid_response");
    this.turnId = turnId;
    const clearTurn: () => void = () => {
      // UNTRUST-ALLOW-NULLISH: The completed or failed turn is no longer cancellable once its terminal result has been delivered, so clearing it prevents stale interrupt requests.
      this.turnId = undefined;
    };
    return await collectTurn(client, this.threadId, turnId, onDelta, onEvent).finally(clearTurn);
  }

  public async cancel(): Promise<Result<void, CodexRuntimeErrorT>> {
    const client: CodexJsonRpcClient | undefined = this.client;
    const threadId: string | undefined = this.threadId;
    const turnId: string | undefined = this.turnId;
    if (!client || !threadId || !turnId) return err("not_running");
    const result: Result<unknown, string> = await client.request("turn/interrupt", { threadId, turnId });
    return result.isOk() ? ok(void 0) : err("request_failed");
  }
}

function workspaceConfigurationsMatch(left: CodexWorkspaceConfiguration | undefined, right: CodexWorkspaceConfiguration): boolean {
  if (!left) return false;
  return left.cwd === right.cwd &&
    left.workFolders.length === right.workFolders.length &&
    left.workFolders.every((folder: string, index: number) => folder === right.workFolders[index]);
}

// UNTRUST-ALLOW-NULLISH: A malformed Codex response has no usable thread identifier; returning undefined lets the caller report a typed protocol error.
function extractThreadId(value: unknown): string {
  if (!value || typeof value !== "object" || !("thread" in value)) {
    return "";
  }
  const thread: unknown = (value as { readonly thread: unknown }).thread;
  if (!thread || typeof thread !== "object" || !("id" in thread) || typeof (thread as { readonly id: unknown }).id !== "string") {
    return "";
  }
  return (thread as { readonly id: string }).id;
}

// UNTRUST-ALLOW-NULLISH: A malformed Codex response has no usable turn identifier; returning undefined lets the caller report a typed protocol error.
function extractTurnId(value: unknown): string {
  if (!value || typeof value !== "object" || !("turn" in value)) {
    return "";
  }
  const turn: unknown = (value as { readonly turn: unknown }).turn;
  if (!turn || typeof turn !== "object" || !("id" in turn) || typeof (turn as { readonly id: unknown }).id !== "string") {
    return "";
  }
  return (turn as { readonly id: string }).id;
}

function collectTurn(client: CodexJsonRpcClient, threadId: string, turnId: string, onDelta?: (delta: string) => void, onEvent?: (notification: CodexNotification) => void): Promise<Result<string, CodexRuntimeErrorT>> {
  return new Promise((resolve) => {
    let response: string = "";
    let timeout: NodeJS.Timeout;
    const finish: (result: Result<string, CodexRuntimeErrorT>) => void = (result) => {
      dispose();
      clearTimeout(timeout);
      resolve(result);
    };
    const handle: (notification: CodexNotification) => void = (notification) => {
      if (onEvent && notification.method !== "item/agentMessage/delta" && notification.method !== "turn/completed") onEvent(notification);
      if (notification.method === "item/agentMessage/delta") {
        // UNTRUST-ALLOW-NULLISH: Codex notifications may omit params; an empty fixed-shape record safely represents that case.
        const params: DeltaParams = (notification.params ?? {}) as DeltaParams;
        if (params.threadId === threadId && params.turnId === turnId && typeof params.delta === "string") {
          response += params.delta;
          if (onDelta) onDelta(params.delta);
        }
      }
      if (notification.method === "turn/completed") {
        // UNTRUST-ALLOW-NULLISH: Codex completion notifications may omit params; an empty fixed-shape record safely represents that case.
        const params: CompletionParams = (notification.params ?? {}) as CompletionParams;
        // UNTRUST-ALLOW-NULLISH: Completion parsing treats an absent turn as a non-matching notification.
        const completedTurn: CompletedTurn = (params.turn ?? {}) as CompletedTurn;
        if (params.threadId === threadId && completedTurn.id === turnId) {
          finish(completedTurn.status === "completed" ? ok(response) : err("turn_failed"));
        }
      }
    };
    const dispose: () => boolean = client.onNotification(handle);
    timeout = setTimeout(() => finish(err("turn_timeout")), 120_000);
  });
}
