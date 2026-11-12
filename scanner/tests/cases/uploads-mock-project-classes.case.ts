import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:net';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../../server/dist/app.js';
import { MemoryClassRepository } from '../../../server/dist/memory-class-repository.js';
import { loggedFetch } from '../../dist/utils.js';
import type { ClassDetails, CompositeTypeT } from '@codaigram/shared/class-types';
import { JsonMap } from '@codaigram/shared/json-map';

export const TEST_CASE_METADATA = {
  title: 'uploads every scanned member and unknown reference relationship',
  prompt: {
    availability: 'available',
    text: 'Scan mock TypeScript declarations with fields, accessors, single and overloaded methods, upload them, and assert classesDetails returns every member and UNK reference relationship.'
  }
};

const EXPECTED_DETAILS: readonly ClassDetails[] = [
  { name: 'AssigneeContract', methods: [], relations: [], isPartial: false },
  { name: 'ChildTask', methods: [], relations: [], isPartial: false },
  { name: 'Queue', methods: [], relations: [], isPartial: false },
  {
    name: 'Task',
    methods: [
      { name: 'contract', overloads: [[{ arg: '+RO', t: 'TaskContract' }]] },
      { name: 'children', overloads: [[{ arg: '+RW', t: 'ChildTask[]' }]] },
      { name: 'assignees', overloads: [[{ arg: '+RW', t: 'Queue<AssigneeContract>' }]] },
      {
        name: 'assign',
        overloads: [[
          { arg: 'assignee', t: 'AssigneeContract' },
          { arg: 'urgent', t: 'boolean' }
        ]]
      },
      { name: 'count', overloads: [[{ arg: '+PROP', t: 'number' }]] },
      {
        name: 'lookup',
        overloads: [
          [{ arg: 'value', t: 'string' }],
          [{ arg: 'value', t: 'number' }],
          [{ arg: 'value', t: 'string | number' }]
        ]
      }
    ],
    relations: [
      { kind: 'UNK', name: 'contract', target: 'TaskContract', many: false },
      { kind: 'UNK', name: 'children', target: 'ChildTask', many: true },
      { kind: 'UNK', name: 'assignees', target: 'AssigneeContract', many: true }
    ],
    isPartial: false },
  {
    name: 'TaskContract',
    methods: [
      { name: 'task', overloads: [[{ arg: '+RW', t: 'Task' }]] },
      {
        name: 'options',
        overloads: [[{
          arg: '+RW',
          t: new JsonMap<string, CompositeTypeT>([
            ['format', 'string'],
            ['limits', new JsonMap<string, CompositeTypeT>([
              ['limitType', ['none', 'count', 'size']],
              ['maximum', 'number'] ])] ])
        }]]
      },
      { name: 'describe', overloads: [[{ arg: 'format', t: 'string' }]] }
    ],
    relations: [{ kind: 'UNK', name: 'task', target: 'Task', many: false }],
    isPartial: false }
];

function executeScanner(serverUrl: string): Promise<string> {
  const scannerPath: string = path.resolve('dist/index.js');
  const fixturePath: string = path.resolve('mock-testproject');
  const logDirectory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-scanner-classes-upload-'));
  const logPath: string = path.join(logDirectory, 'scanner.log');
  return new Promise<string>((resolve, reject) => {
    const processHandle: ChildProcessWithoutNullStreams = spawn(process.execPath, [scannerPath, 'mock-class-project', fixturePath, '--types', 'class', '--server-url', serverUrl, '--logfile', logPath], { stdio: 'pipe' });
    let stdout: string = '';
    let stderr: string = '';
    processHandle.stdout.setEncoding('utf8');
    processHandle.stdout.on('data', (chunk: string) => { stdout += chunk; });
    processHandle.stderr.setEncoding('utf8');
    processHandle.stderr.on('data', (chunk: string) => { stderr += chunk; });
    processHandle.once('error', reject);
    processHandle.once('close', (exitCode: number | null) => exitCode === 0 ? resolve(stdout) : reject(new Error(`Scanner exited with ${String(exitCode)}: ${stderr.trim()}`)));
  }).finally(() => { rmSync(logDirectory, { recursive: true, force: true }); });
}

export function registerUploadsMockProjectClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address: ReturnType<Server['address']> = server.address();
      assert.ok(address && typeof address !== 'string');
      const serverUrl: string = `http://127.0.0.1:${String(address.port)}`;
      const output: string = await executeScanner(serverUrl);
      assert.match(output, /^CLASS Task$/m);
      assert.match(output, /^INTERFACE TaskContract$/m);
      assert.match(output, /^  FIELD contract \+RO: TaskContract$/m);
      assert.match(output, /^  FIELD children \+RW: ChildTask\[\]$/m);
      assert.match(output, /^  METHOD assign\(assignee: AssigneeContract, urgent: boolean\)$/m);
      assert.match(output, /^  METHOD lookup\(value: string\)$/m);
      assert.match(output, /^  METHOD lookup\(value: number\)$/m);
      assert.match(output, /^  METHOD lookup\(value: string \| number\)$/m);
      assert.match(output, /^  ACCESSOR count \+PROP: number$/m);
      assert.match(output, /^  RELATION UNK assignees: AssigneeContract\[\]$/m);
      const response: Response = await loggedFetch(`${serverUrl}/api/classesDetails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: EXPECTED_DETAILS.map((detail: ClassDetails) => detail.name) }) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(EXPECTED_DETAILS)));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error === undefined ? resolve() : reject(error)));
    }
  });
}
