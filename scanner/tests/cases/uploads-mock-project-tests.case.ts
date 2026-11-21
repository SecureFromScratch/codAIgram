import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../../server/dist/app.js';
import { MemoryClassRepository } from '../../../server/dist/memory-class-repository.js';
import { loggedFetch } from '../../dist/scanner_utils.js';

export const TEST_CASE_METADATA = {
  title: 'uploads the complete, duplicate-free mock test inventory to the shared server',
  prompt: {
    availability: 'available',
    old: 'Start an in-memory server, execute Scanner against the fixed mock project, and assert getTests returns every expected group, case, description, and prompt without duplicates.'
  ,
    history: [
      { when: "2026/11/15 09:35", text: "write a test. it starts an in-memory server, executes the scanner on the mock test. it then calls getTests route on the erver. this returns a list of all tests. for each test we have its group, name, description, prompt.\nensure this list is identical to the groups/test cases in the mock project (you can hardcode this as the mock project tests lists will NOT be changes - they are for testing only)" },
      { when: "2026/11/15 09:35", text: "--server-url is a good idea. the server itself is the same server that is in this project.\nno - there is no protocol yet. write the test and then when it fails (the server will report 404) fix the server by adding an updateTests route, accepting a list of tests.\nbtw: when writing the above mentioned test - make sure the result does not contain duplicates (a count can be used)" },
      { when: "2026/11/15 09:35", text: "in the test use --server-url localhost:5187" },
    ],
  }
};

type ExpectedTestT = {
  readonly group: string;
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
};

const EXPECTED_TESTS: readonly ExpectedTestT[] = [
  { group: 'model', name: 'initial-diagram', description: 'models the initial class, members, and one-to-many relationship', prompt: 'Create the initial ClassDiagram model with methods and an OWNS one-to-many relation to Class.' },
  { group: 'model', name: 'multiclass', description: 'accepts multiple classes, typed properties, inline enums, type-only arguments and partial classes', prompt: 'Add a DSL test allowing multiple classes separated by an empty line, partial classes, typed properties, and inline enums.' },
  { group: 'model', name: 'ownership', description: 'parses single, many, unnamed, and incomplete ownership', prompt: 'Test OWNS changes for singular and many arity, missing relation names, and incomplete referenced types.' },
  { group: 'model', name: 'reject-incomplete', description: 'rejects incomplete relationships and headings', prompt: 'Show syntax errors for a missing class name and for an incomplete OWNS type.' },
  { group: 'model', name: 'reject-method', description: 'rejects incorrectly indented and incomplete methods', prompt: 'Require methods to be indented two spaces and multiline method continuations to use at least four spaces.' },
  { group: 'model', name: 'reject-separator', description: 'rejects missing separators, property colons and types, and duplicate class names', prompt: 'Validate the DSL: classes require a blank-line separator and properties require a colon and a type.' },
  { group: 'model', name: 'reject-unknown', description: 'rejects unknown declarations and malformed parameters', prompt: 'Report invalid method syntax but allow typed generic parameter types in the diagram DSL.' },
  { group: 'model', name: 'semantic-update', description: 'updates semantic data when the text changes', prompt: 'Make the graph representation update dynamically when diagram text changes.' },
  { group: 'model', name: 'valid-multiline', description: 'accepts blank lines and properly indented multiline signatures', prompt: 'Allow blank space and multiline methods when continuation lines are indented by at least four spaces.' },
  { group: 'signatures', name: 'empty-members', description: 'keeps empty methods and unrecognized members intact', prompt: 'Display method names in class boxes while preserving non-method DSL lines without changing their text.' },
  { group: 'signatures', name: 'parameter-tooltip', description: 'shows parameter names and records their types and character ranges', prompt: 'In a class diagram, show only method and parameter names while the tooltip shows parameter types.' }
];

function executeScanner(serverUrl: string): Promise<void> {
  const scannerPath: string = path.resolve('scanner/dist/index.js');
  const fixturePath: string = path.resolve('scanner/mock-testproject');
  const logDirectory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-scanner-tests-upload-'));
  const logPath: string = path.join(logDirectory, 'scanner.log');
  return new Promise<void>((resolve, reject) => {
    const processHandle = spawn(process.execPath, [scannerPath, 'mock-testproject', fixturePath, '--types', 'test', '--server-url', serverUrl, '--logfile', logPath]);
    let stderr: string = '';
    processHandle.stdout.resume();
    processHandle.stderr.setEncoding('utf8');
    processHandle.stderr.on('data', (chunk: string) => { stderr += chunk; });
    processHandle.once('error', reject);
    processHandle.once('close', (exitCode: number | null) => exitCode === 0 ? resolve() : reject(new Error(`Scanner exited with ${String(exitCode)}: ${stderr.trim()}`)));
  }).finally(() => { rmSync(logDirectory, { recursive: true, force: true }); });
}

export function registerUploadsMockProjectTestsCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const serverUrl: string = 'http://localhost:5187';
    const server = createApp(new MemoryClassRepository()).listen(5187, '127.0.0.1');
    try {
      await executeScanner(serverUrl);
      const response: Response = await loggedFetch(`${serverUrl}/api/mock-testproject/getTests`);
      assert.equal(response.status, 200);
      const actualTests: readonly { group: string; name: string; description: string; lastChangedAt: string }[] = await response.json() as readonly { group: string; name: string; description: string; lastChangedAt: string }[];
      assert.deepEqual(actualTests.map(({ group, name, description }) => ({ group, name, description })), EXPECTED_TESTS.map(({ group, name, description }) => ({ group, name, description })));
      actualTests.forEach((item) => { assert.ok(!('prompt' in item)); assert.ok(!Number.isNaN(Date.parse(item.lastChangedAt))); });
      const historyResponse: Response = await loggedFetch(`${serverUrl}/api/mock-testproject/getHistory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(EXPECTED_TESTS.map(({ group, name }) => ({ group, name }))),
      });
      assert.equal(historyResponse.status, 200);
      const histories: readonly { group: string; name: string; prompts: { when: string; text: string }[] }[] = await historyResponse.json() as readonly { group: string; name: string; prompts: { when: string; text: string }[] }[];
      assert.deepEqual(histories.map((item) => item.prompts.length), [0, 3, 1, 0, 1, 2, 0, 0, 1, 0, 2]);
      histories.forEach((item, index) => {
        assert.deepEqual([item.group, item.name], [EXPECTED_TESTS[index]?.group, EXPECTED_TESTS[index]?.name]);
        item.prompts.forEach((entry) => {
          assert.equal(entry.when, '2026/11/15 09:35');
          assert.notEqual(entry.text, EXPECTED_TESTS[index]?.prompt);
        });
      });
      assert.equal(histories[1]?.prompts[1]?.text, 'add a test of the dsl - multiple classes are allowedd, separated by an empty line\npartial classes (the class name only) are also allowed.');
      const uniqueKeys: Set<string> = new Set<string>(actualTests.map((item) => `${item.group}.${item.name}`));
      assert.equal(actualTests.length, EXPECTED_TESTS.length);
      assert.equal(uniqueKeys.size, actualTests.length);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error === undefined ? resolve() : reject(error)));
    }
  });
}
