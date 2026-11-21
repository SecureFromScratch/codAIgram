import type { Readable, Writable } from "node:stream";
import { err, ok, Result } from "neverthrow";

export interface CodexClientInfo {
  readonly name: string;
  readonly title: string;
  readonly version: string;
}

export type CodexInitializeErrorT = "write_failed" | "process_closed" | "invalid_response" | "initialize_failed";

interface JsonRpcResponse {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: unknown;
}

export async function initializeCodexAppServer(stdin: Writable, stdout: Readable, clientInfo: CodexClientInfo): Promise<Result<unknown, CodexInitializeErrorT>> {
  const request: string = JSON.stringify({ id: 1, method: "initialize", params: { clientInfo } }) + "\n";
  const writeRequest: () => boolean = () => stdin.write(request);
  const written: Result<boolean, string> = Result.fromThrowable(writeRequest, () => "write_failed")();
  if (written.isErr() || written.value === false) return err("write_failed");
  const response: Result<JsonRpcResponse, CodexInitializeErrorT> = await readResponse(stdout);
  if (response.isErr()) return err(response.error);
  if ("error" in response.value) return err("initialize_failed");
  if (response.value.id !== 1) return err("invalid_response");
  if (!("result" in response.value)) return err("invalid_response");
  const writeInitialized: () => boolean = () => stdin.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
  const initialized: Result<boolean, string> = Result.fromThrowable(writeInitialized, () => "write_failed")();
  if (initialized.isErr() || initialized.value === false) return err("write_failed");
  return ok(response.value.result);
}

function readResponse(stdout: Readable): Promise<Result<JsonRpcResponse, CodexInitializeErrorT>> {
  return new Promise((resolve) => {
    let buffer: string = "";
    const onData: (chunk: Buffer | string) => void = (chunk) => {
      buffer += chunk.toString();
      const newline: number = buffer.indexOf("\n");
      if (newline < 0) return;
      const line: string = buffer.slice(0, newline);
      stdout.removeListener("data", onData);
      const parsed: Result<unknown, string> = Result.fromThrowable(() => JSON.parse(line) as unknown, () => "invalid_response")();
      if (parsed.isErr() || !parsed.value || typeof parsed.value !== "object") {
        resolve(err("invalid_response"));
        return;
      }
      resolve(ok(parsed.value as JsonRpcResponse));
    };
    stdout.on("data", onData);
    stdout.once("close", () => {
      stdout.removeListener("data", onData);
      resolve(err("process_closed"));
    });
  });
}
