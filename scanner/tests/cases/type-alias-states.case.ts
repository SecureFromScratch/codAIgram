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
  title: 'marks type aliases and union aliases in ClassDetails state',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026-11-25', text: 'ClassDetails states distinguish ordinary aliases from union aliases while preserving function delegates.' },
    ],
  },
};

type TypeStateDetailsT = { name: string; state?: string };

export function registerTypeAliasStatesCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const directory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-type-alias-scan-'));
    const sourceDirectory: string = path.join(directory, 'src');
    mkdirSync(sourceDirectory);
    writeFileSync(path.join(sourceDirectory, 'types.ts'), [
      'interface ExistingType { value: string; }',
      'interface OtherType { count: number; }',
      'interface ThirdType { enabled: boolean; }',
      'export type ArrayAlias = ExistingType[];',
      'export type DirectAlias = ExistingType;',
      'export type CombinedTypes = ExistingType | OtherType | ThirdType;',
      '',
    ].join('\n'), 'utf8');
    const server: ReturnType<ReturnType<typeof createApp>['listen']> = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const address: ReturnType<Server['address']> = server.address();
      assert.ok(address && typeof address !== 'string');
      const base: string = `http://127.0.0.1:${String(address.port)}`;
      await promisify(execFile)(process.execPath, [path.resolve('scanner/dist/index.js'), 'type-alias-states', sourceDirectory, '--types', 'class', '--server-url', base]);
      const response: Response = await fetch(`${base}/api/type-alias-states/classesDetails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classNames: ['ArrayAlias', 'DirectAlias', 'CombinedTypes'] }),
      });
      assert.equal(response.status, 200);
      const details: TypeStateDetailsT[] = await response.json() as TypeStateDetailsT[];
      assert.deepEqual(details.map((detail: TypeStateDetailsT) => [detail.name, detail.state]), [
        ['ArrayAlias', 'alias'],
        ['DirectAlias', 'alias'],
        ['CombinedTypes', 'union'],
      ]);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve()));
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
