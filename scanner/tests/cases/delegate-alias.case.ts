import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { createApp } from '../../../server/dist/app.js';
import { MemoryClassRepository } from '../../../server/dist/memory-class-repository.js';

export const TEST_CASE_METADATA = {
  title: 'scans function type aliases as delegates with arguments and return type',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/25 00:00', text: 'A TypeScript function type alias such as BridgeSocketFactory is a delegate. Scan it as state delegate, with one nameless member containing its parameter overload and return type.' },
    ],
  },
};
type DelegateDetailsT = { name: string; state?: string; methods: { name: string; overloads: { arg: string; t: string }[][] }[]; relations: unknown[] };

export function registerDelegateAliasCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const directory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-delegate-scan-'));
    const sourceDirectory: string = path.join(directory, 'src');
    mkdirSync(sourceDirectory);
    writeFileSync(path.join(sourceDirectory, 'bridge-socket-factory.ts'), 'export interface BridgeSocket { close(): void; }\nexport type BridgeSocketFactory = (url: string, origin: string) => BridgeSocket;\nexport interface BridgeSocketFactoryOverloads { (url: string): BridgeSocket; (url: URL): BridgeSocket; }\nexport interface Formatter { format(value: string): string; format(value: number): number; }\n', 'utf8');
    const server: ReturnType<ReturnType<typeof createApp>['listen']> = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address: ReturnType<Server['address']> = server.address();
      assert.ok(address && typeof address !== 'string');
      const base: string = `http://127.0.0.1:${String(address.port)}`;
      await promisify(execFile)(process.execPath, [path.resolve('scanner/dist/index.js'), 'delegates', sourceDirectory, '--types', 'class', '--server-url', base]);
      const response: Response = await fetch(`${base}/api/delegates/classesDetails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: ['BridgeSocketFactory', 'BridgeSocketFactoryOverloads', 'Formatter'] }),
      });
      assert.equal(response.status, 200);
      const classes: DelegateDetailsT[] = await response.json() as DelegateDetailsT[];
      const delegate: DelegateDetailsT | undefined = classes.find((item: DelegateDetailsT) => item.name === 'BridgeSocketFactory');
      assert.ok(delegate);
      assert.equal(delegate.name, 'BridgeSocketFactory');
      assert.equal(delegate.state, 'delegate');
      assert.deepEqual(delegate.methods, [{
        name: '',
        overloads: [[{ arg: '+RET', t: 'BridgeSocket' }, { arg: 'url', t: 'string' }, { arg: 'origin', t: 'string' }]],
      }]);
      assert.deepEqual(delegate.relations, []);
      const callable: DelegateDetailsT | undefined = classes.find((item: DelegateDetailsT) => item.name === 'BridgeSocketFactoryOverloads');
      assert.ok(callable);
      assert.equal(callable.state, undefined);
      assert.deepEqual(callable.methods, [{
        name: '',
        overloads: [
          [{ arg: '+RET', t: 'BridgeSocket' }, { arg: 'url', t: 'string' }],
          [{ arg: '+RET', t: 'BridgeSocket' }, { arg: 'url', t: 'URL' }],
        ],
      }]);
      const formatter: DelegateDetailsT | undefined = classes.find((item: DelegateDetailsT) => item.name === 'Formatter');
      assert.ok(formatter);
      assert.deepEqual(formatter.methods, [{
        name: 'format',
        overloads: [
          [{ arg: '+RET', t: 'string' }, { arg: 'value', t: 'string' }],
          [{ arg: '+RET', t: 'number' }, { arg: 'value', t: 'number' }],
        ],
      }]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve()));
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
