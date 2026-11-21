import * as assert from "node:assert";
import { PassThrough } from "node:stream";
import { initializeCodexAppServer } from "../../src/codexInitialize";
import type { CodexClientInfo } from "../../src/codexInitialize";
import type { TestCaseMetadata } from "../testCaseMetadata";

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "initializes Codex over JSONL and acknowledges it",
  prompt: {
    availability: "available",
    history: [{ when: "2026-11-19", text: "Initialize the Codex app server JSONL protocol." }]
  }
};

type InitializeResultT = Awaited<ReturnType<typeof initializeCodexAppServer>>;
type WriteT = PassThrough["write"];

export function registerCodexInitializeCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const stdin: PassThrough = new PassThrough();
    const stdout: PassThrough = new PassThrough();
    const writes: string[] = [];
    const originalWrite: WriteT = stdin.write.bind(stdin);
    stdin.write = ((chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return originalWrite(chunk);
    }) as WriteT;
    const clientInfo: CodexClientInfo = { name: "bridge", title: "Bridge", version: "1" };
    const pending: Promise<InitializeResultT> = initializeCodexAppServer(stdin, stdout, clientInfo);
    await Promise.resolve();
    assert.deepStrictEqual(JSON.parse(writes[0]), { id: 1, method: "initialize", params: { clientInfo } });
    stdout.write('{"id":1,"result":{"codexHome":"x"}}\n');
    assert.deepStrictEqual((await pending)._unsafeUnwrap(), { codexHome: "x" });
    assert.deepStrictEqual(JSON.parse(writes[1]), { method: "initialized", params: {} });
  });
}
