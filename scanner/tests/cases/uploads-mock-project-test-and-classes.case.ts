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

export const TEST_CASE_METADATA = {
  title: 'scans and uploads tests and classes when both types are requested',
  prompt: {
    availability: 'available',
    text: 'Add a Scanner test proving that --types test,class scans and uploads both the test inventory and class declarations.'
  }
};

type TestsInventoryItemT = {
  readonly group: string;
  readonly name: string;
};

type ClassDetailsItemT = {
  readonly name: string;
};

function executeScanner(serverUrl: string): Promise<string> {
  const scannerPath: string = path.resolve('dist/index.js');
  const fixturePath: string = path.resolve('mock-testproject');
  const logDirectory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-scanner-combined-upload-'));
  const logPath: string = path.join(logDirectory, 'scanner.log');
  return new Promise<string>((resolve, reject) => {
    const folders: string = `${path.join(fixturePath, 'src')},${path.join(fixturePath, 'tests')},${path.join(fixturePath, 'src')}`;
    const processHandle: ChildProcessWithoutNullStreams = spawn(process.execPath, [scannerPath, 'mock-combined-project', folders, '--types', 'test,class', '--server-url', serverUrl, '--logfile', logPath], { stdio: 'pipe' });
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

export function registerUploadsMockProjectTestAndClassesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address: ReturnType<Server['address']> = server.address();
      assert.ok(address && typeof address !== 'string');
      const serverUrl: string = `http://127.0.0.1:${String(address.port)}`;
      const output: string = await executeScanner(serverUrl);
      assert.match(output, /^TEST GROUP model$/m);
      assert.match(output, /^TEST CASE model\.initial-diagram$/m);
      assert.match(output, /^CLASS Task$/m);
      assert.match(output, /^INTERFACE TaskContract$/m);
      assert.equal(output.match(/^CLASS Task$/gm)?.length, 1);

      const testsResponse: Response = await loggedFetch(`${serverUrl}/api/getTests`);
      assert.equal(testsResponse.status, 200);
      const inventory: readonly TestsInventoryItemT[] = await testsResponse.json() as readonly TestsInventoryItemT[];
      assert.ok(inventory.some((item: TestsInventoryItemT) => item.group === 'model' && item.name === 'initial-diagram'));

      const classesResponse: Response = await loggedFetch(`${serverUrl}/api/classesDetails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: ['Task', 'TaskContract'] })
      });
      assert.equal(classesResponse.status, 200);
      const classes: readonly ClassDetailsItemT[] = await classesResponse.json() as readonly ClassDetailsItemT[];
      assert.deepEqual(classes.map((item: ClassDetailsItemT) => item.name), ['Task', 'TaskContract']);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error === undefined ? resolve() : reject(error)));
    }
  });
}
