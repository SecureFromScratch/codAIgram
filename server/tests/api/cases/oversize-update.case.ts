import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../../../dist/app.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
export const TEST_CASE_METADATA = { title: 'rejects an oversize update', prompt: { availability: 'unavailable', reason: 'Migrated existing coverage.' } };
export function registerOversizeUpdateCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { const server = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1'); try { await new Promise<void>((resolve): void => server.once('listening', resolve)); const address = server.address(); assert.ok(address !== null && typeof address !== 'string'); const response = await fetch(`http://127.0.0.1:${String(address.port)}/api/updateClasses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ name: 'TooLarge', methods: ['a'.repeat(270000)], relations: [], isPartial: false }]) }); assert.equal(response.status, 413); } finally { await new Promise<void>((resolve, reject): void => server.close((error?: Error): void => error === undefined ? resolve() : reject(error))); } }); }
