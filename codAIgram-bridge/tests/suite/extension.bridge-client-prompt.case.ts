import * as assert from "node:assert";
import * as path from "node:path";
import { WebSocketServer } from "ws";
import NodeWebSocket from "ws";
import { createBridgeClient } from "@codaigram/bridge-protocol";
import type { BridgeClient, BridgeSocket, GetCodeResult, ScanClassResult, ScanTestsResult } from "@codaigram/bridge-protocol";
import type { BridgeApi } from "./extension.helpers";
import type { TestCaseMetadata } from "../testCaseMetadata";
import { getTypeCodes } from "@codaigram/scan-shared";

type ChatRequestT = {
  readonly type: "chat/ask";
  readonly id: string;
  readonly cwd: string;
  readonly workFolders: readonly string[];
};

type PromptRequestSnapshotT = {
  readonly cwd: string;
  readonly workFolders: readonly string[];
};
type CodeRequestT = {
  readonly projectName?: string;
  readonly workFolders?: readonly string[];
  readonly filepath?: string;
  readonly typeName?: string;
};

export const TEST_CASE_METADATA: TestCaseMetadata = {
  title: "sends a prompt and returns the AI response",
  prompt: {
    availability: "available",
    reason: "The client prompt API is exercised against a deterministic protocol server.",
    history: [{ when: "2026/11/23 09:35", text: "Update bridge prompt-call tests to assert that cwd and workFolders are sent with each prompt." }]
  }
};

export function registerBridgeClientPromptCase(_getApi: () => BridgeApi, trustedOrigin: string): void {
    test(TEST_CASE_METADATA.title, async () => {
        const server: WebSocketServer = new WebSocketServer({ port: 0 });
        const promptRequests: PromptRequestSnapshotT[] = [];
        await new Promise<void>((resolve) => server.once("listening", () => resolve()));
        const address: ReturnType<WebSocketServer["address"]> = server.address();
        assert.ok(address && typeof address !== "string");
        server.on("connection", (socket) => {
            socket.send(JSON.stringify({ version: 1, type: "welcome" }));
            socket.on("message", (data) => {
                const request: { readonly type: string; readonly id: string } = JSON.parse(data.toString()) as { readonly type: string; readonly id: string };
                if (request.type === "workspace_folders") {
                    socket.send(JSON.stringify({
                      version: 1,
                      type: "workspace_folders",
                      id: request.id,
                      syncTimestamp: 1,
                      folders: []
                    }));
                }
                if (request.type === "chat/ask") {
                    const chatRequest: ChatRequestT = request as ChatRequestT;
                    promptRequests.push({
                      cwd: chatRequest.cwd,
                      workFolders: chatRequest.workFolders
                    });
                    socket.send(JSON.stringify({
                      version: 1,
                      type: "chat_response",
                      id: request.id,
                      response: "Lincoln"
                    }));
                }
                if (request.type === "scan/tests") socket.send(JSON.stringify({
                  version: 1,
                  type: "scan_tests_response",
                  id: request.id,
                  result: { groups: ["model"], cases: [] }
                }));
                if (request.type === "scan/classes") socket.send(JSON.stringify({
                  version: 1,
                  type: "scan_classes_response",
                  id: request.id,
                  result: []
                }));
                if (request.type === "code/get") {
                    const codeRequest: CodeRequestT = request as CodeRequestT;
                    if (codeRequest.projectName !== "mock-project") socket.send(JSON.stringify({
                      version: 1,
                      type: "error",
                      id: request.id,
                      code: "unknown_project"
                    }));
                    else if (!codeRequest.workFolders || codeRequest.workFolders.length === 0) socket.send(JSON.stringify({
                      version: 1,
                      type: "error",
                      id: request.id,
                      code: "invalid_work_folders"
                    }));
                    else if (!codeRequest.filepath) socket.send(JSON.stringify({
                      version: 1,
                      type: "error",
                      id: request.id,
                      code: "invalid_filepath"
                    }));
                    else if (codeRequest.filepath.split(/[\\/]/u).includes("..")) socket.send(JSON.stringify({
                      version: 1,
                      type: "error",
                      id: request.id,
                      code: "invalid_filepath"
                    }));
                    else {
                        const codes: readonly string[] = getTypeCodes(codeRequest.workFolders, codeRequest.filepath, codeRequest.typeName ?? "");
                        if (codes.length === 0) socket.send(JSON.stringify({
                          version: 1,
                          type: "error",
                          id: request.id,
                          code: "type_not_found"
                        }));
                        else socket.send(JSON.stringify({
                          version: 1,
                          type: "code_response",
                          id: request.id,
                          code: codes.length === 1 ? codes[0] : codes
                        }));
                    }
                }
            });
        });
        const client: BridgeClient = createBridgeClient(`ws://127.0.0.1:${address.port}/test-token`, trustedOrigin, (url, origin) => new NodeWebSocket(url, { headers: { Origin: origin } }) as unknown as BridgeSocket);
        try {
            await client.ready;
            const response: string = await client.promptAi("Who was the president of the US during the Civil War? Respond with only the family name.", { cwd: "C:\\workspace", workFolders: [] });
            assert.strictEqual(response, "Lincoln");
            const configuredResponse: string = await client.promptAi("Inspect both folders", {
              cwd: "C:\\workspace-main",
              workFolders: ["C:\\workspace-additional"]
            });
            assert.strictEqual(configuredResponse, "Lincoln");
            const testsScan: ScanTestsResult = await client.scanForTests(["C:\\workspace-main"]);
            assert.deepStrictEqual(testsScan.groups, ["model"]);
            const classesScan: readonly ScanClassResult[] = await client.scanForClasses(["C:\\workspace-main"]);
            assert.deepStrictEqual(classesScan, []);
            const classCode: GetCodeResult = await client.getCode("mock-project", [path.resolve(__dirname, "../../../../scanner/mock-testproject")], "src/class-details.ts", "ClassDetails");
            assert.equal(typeof classCode, "string");
            assert.match(classCode as string, /class\s+ClassDetails|interface\s+ClassDetails/);
            const multiRoots: readonly string[] = [
              path.resolve(__dirname, "../../../../codAIgram-bridge/tests/mock-get-code-project-one"),
              path.resolve(__dirname, "../../../../codAIgram-bridge/tests/mock-get-code-project-two"),
              path.resolve(__dirname, "../../../../codAIgram-bridge/tests/mock-get-code-project-three")
            ];
            const matchingCode: GetCodeResult = await client.getCode("mock-project", multiRoots, "src/shared-type.ts", "SharedType");
            assert.ok(Array.isArray(matchingCode));
            assert.strictEqual(matchingCode.length, 2);
            assert.ok(matchingCode.every((snippet: string) => /class\s+SharedType/u.test(snippet)));
            const mockProjectRoot: string = path.resolve(__dirname, "../../../../scanner/mock-testproject");
            await assert.rejects(() => client.getCode("missing-project", [mockProjectRoot], "src/class-details.ts", "ClassDetails"), /unknown_project/);
            await assert.rejects(() => client.getCode("mock-project", [], "src/class-details.ts", "ClassDetails"), /workFolders must be a non-empty list/);
            await assert.rejects(() => client.getCode("mock-project", [mockProjectRoot], "", "ClassDetails"), /filepath must not be empty/);
            await assert.rejects(() => client.getCode("mock-project", [mockProjectRoot], "../mock-testproject/src/class-details.ts", "ClassDetails"), /relative traversal/);
            await assert.rejects(() => client.getCode("", [mockProjectRoot], "src/class-details.ts", "ClassDetails"), /projectName must not be empty/);
            await assert.rejects(() => client.getCode("mock-project", [mockProjectRoot], "src/class-details.ts", "NoSuchType"), /type_not_found/);
            await assert.rejects(() => client.getCode("mock-project", [path.join(mockProjectRoot, "src")], "src/class-details.ts", "ClassDetails"), /type_not_found/);
            assert.deepStrictEqual(promptRequests, [
              { cwd: "C:\\workspace", workFolders: [] },
              {
                cwd: "C:\\workspace-main",
                workFolders: ["C:\\workspace-additional"]
              }
            ]);
            await assert.rejects(() => client.promptAi("Inspect", { cwd: "", workFolders: [] }), /cwd must not be empty/);
            await assert.rejects(() => client.promptAi("Inspect", { cwd: "C:\\workspace", workFolders: [""] }), /workFolders must be a list of non-empty paths/);
        } finally {
            await client.close();
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
}
