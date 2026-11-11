import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../../../dist/app.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';

export const TEST_CASE_METADATA = { title: 'returns requested class details', prompt: { availability: 'unavailable', reason: 'Migrated existing API coverage.' } };

export function registerClassDetailsCase(): void {
  test(TEST_CASE_METADATA.title, async (): Promise<void> => {
    const server = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve): void => server.once('listening', resolve));
      const address = server.address();
      assert.ok(address !== null && typeof address !== 'string');
      const response: Response = await fetch(`http://127.0.0.1:${String(address.port)}/api/classesDetails`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classNames: ['ClassDiagram', 'Class', 'Unknown'] }) });
      assert.equal(response.status, 200);
      const result: readonly { readonly name: string }[] = await response.json() as readonly { readonly name: string }[];
      assert.deepEqual(result.map((item): string => item.name), ['ClassDiagram', 'Class']);
    } finally {
      await new Promise<void>((resolve, reject): void => server.close((error?: Error): void => error === undefined ? resolve() : reject(error)));
    }
  });
}
