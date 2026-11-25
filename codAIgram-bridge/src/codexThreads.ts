import { err, ok, Result } from "neverthrow";

export type CodexThreadErrorT = "request_failed" | "invalid_response" | "missing_mapping";
export interface CodexThreadParams {
  readonly cwd?: string;
  readonly workFolders?: readonly string[];
  readonly approvalPolicy?: string;
  readonly sandbox?: string;
  readonly threadId?: string;
}
export type CodexThreadRequestT = (method: string, params: CodexThreadParams) => Promise<Result<unknown, string>>;
export type CodexThreadMappingStoreT = {
  readonly read: (conversationId: string) => string | undefined;
  readonly write: (conversationId: string, threadId: string) => void;
};

export class CodexThreadManager {
  public constructor(private readonly request: CodexThreadRequestT, private readonly mappings: CodexThreadMappingStoreT) {}

  public async start(conversationId: string, cwd: string): Promise<Result<string, CodexThreadErrorT>> {
    const response: Result<unknown, string> = await this.request("thread/start", { cwd, approvalPolicy: "on-request", sandbox: "read-only" });
    return this.record(conversationId, response);
  }

  public async resume(conversationId: string): Promise<Result<string, CodexThreadErrorT>> {
    const threadId: string | undefined = this.mappings.read(conversationId);
    if (!threadId) return err("missing_mapping");
    const response: Result<unknown, string> = await this.request("thread/resume", { threadId });
    return this.record(conversationId, response);
  }

  private record(conversationId: string, response: Result<unknown, string>): Result<string, CodexThreadErrorT> {
    if (response.isErr()) return err("request_failed");
    if (!response.value || typeof response.value !== "object" || !("thread" in response.value)) return err("invalid_response");
    const thread: unknown = response.value.thread;
    if (!thread || typeof thread !== "object" || !("id" in thread) || typeof thread.id !== "string") return err("invalid_response");
    this.mappings.write(conversationId, thread.id);
    return ok(thread.id);
  }
}
