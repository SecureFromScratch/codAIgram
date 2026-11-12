import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../../server/dist/app.js';
import { MemoryClassRepository } from '../../../server/dist/memory-class-repository.js';
import { loggedFetch } from '../../dist/utils.js';

export const TEST_CASE_METADATA = {
  title: 'uploads the complete, duplicate-free mock test inventory to the shared server',
  prompt: {
    availability: 'available',
    text: 'Start an in-memory server, execute Scanner against the fixed mock project, and assert getTests returns every expected group, case, description, and prompt without duplicates.'
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
  const scannerPath: string = path.resolve('dist/index.js');
  const fixturePath: string = path.resolve('mock-testproject');
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
      const response: Response = await loggedFetch(`${serverUrl}/api/getTests`);
      assert.equal(response.status, 200);
      const actualTests: readonly ExpectedTestT[] = await response.json() as readonly ExpectedTestT[];
      assert.deepEqual(actualTests, EXPECTED_TESTS);
      const uniqueKeys: Set<string> = new Set<string>(actualTests.map((item: ExpectedTestT) => `${item.group}.${item.name}`));
      assert.equal(actualTests.length, EXPECTED_TESTS.length);
      assert.equal(uniqueKeys.size, actualTests.length);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error === undefined ? resolve() : reject(error)));
    }
  });
}
