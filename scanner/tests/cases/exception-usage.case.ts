import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { createApp } from '../../../server/dist/app.js';
import { MemoryClassRepository } from '../../../server/dist/memory-class-repository.js';

export const TEST_CASE_METADATA = {
  title: 'marks thrown and logAndThrow error classes as exception usage',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 23:42', text: 'add a test in scanner - classes that are thrown or used with logAndThrow are marked as usage: ex (add a server supported "usage" field to a class\'s details - modify server tests to check it is supported as well,' },
      { when: '2026/11/16 00:00', text: 'add a scanner test - a class extending Error is "usage":"ex"' },
    ],
  },
};

export function registerExceptionUsageCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const directory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-exception-usage-'));
    const server: ReturnType<ReturnType<typeof createApp>['listen']> = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address: ReturnType<Server['address']> = server.address();
      assert.ok(address && typeof address !== 'string');
      const base: string = `http://127.0.0.1:${String(address.port)}`;
      await promisify(execFile)(process.execPath, [path.resolve('scanner/dist/index.js'), 'errors', path.resolve('scanner/mock-testproject'), '--types', 'class', '--server-url', base, '--logfile', path.join(directory, 'scanner.log')]);
      const response: Response = await fetch(`${base}/api/classesDetails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: ['ThrownError', 'LoggedError', 'VariableError', 'UnusedError', 'DerivedError', 'ThrownValue', 'OrdinaryClass'] }),
      });
      assert.equal(response.status, 200);
      const result: { name: string; usage?: string }[] = await response.json() as { name: string; usage?: string }[];
      assert.deepEqual(result.map((item) => ({ name: item.name, usage: item.usage })), [
        { name: 'ThrownError', usage: 'ex' },
        { name: 'LoggedError', usage: 'ex' },
        { name: 'VariableError', usage: 'ex' },
        { name: 'UnusedError', usage: 'ex' },
        { name: 'DerivedError', usage: 'ex' },
        { name: 'ThrownValue', usage: 'ex' },
        { name: 'OrdinaryClass', usage: undefined },
      ]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve()));
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
