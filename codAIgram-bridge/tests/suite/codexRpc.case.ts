import * as assert from "node:assert";
import { PassThrough } from "node:stream";
import { CodexJsonRpcClient } from "../../src/codexRpc";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "correlates Codex JSONL requests and forwards notifications",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Forward an initial prompt through the Codex JSONL app-server transport." }]
  }
};

interface RpcResult {
  readonly isOk: () => boolean;
  readonly value?: unknown;
}

export function registerCodexRpcCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const stdin: PassThrough = new PassThrough();
    const stdout: PassThrough = new PassThrough();
    const client: CodexJsonRpcClient = new CodexJsonRpcClient(stdin, stdout);
    const writes: string[] = [];
    stdin.on("data", (chunk: Buffer) => writes.push(chunk.toString()));
    let notificationMethod: string = "";
    client.onNotification((notification) => { notificationMethod = notification.method; });
    const response: Promise<unknown> = client.request("thread/start", { cwd: "C:\\workspace" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(writes.length, 1);
    const request: object = JSON.parse(writes[0]);
    const expectedRequest: object = {
      id: 2,
      method: "thread/start",
      params: { cwd: "C:\\workspace" }
    };
    assert.deepStrictEqual(request, expectedRequest);
    stdout.write(JSON.stringify({ id: 2, result: { thread: { id: "thread-1" } } }) + "\n");
    const result: RpcResult = await response as RpcResult;
    assert.strictEqual(result.isOk(), true);
    assert.deepStrictEqual(result.value, { thread: { id: "thread-1" } });
    const notification: object = {
      method: "item/agentMessage/delta",
      params: { delta: "hello" }
    };
    stdout.write(JSON.stringify(notification) + "\n");
    assert.strictEqual(notificationMethod, "item/agentMessage/delta");
    client.dispose();
  });
}
