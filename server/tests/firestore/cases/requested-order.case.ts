import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../../../dist/app.js';
import { createLocalFirestore, FirestoreClassRepository } from '../../../dist/firestore-repository.js';
import { INITIAL_CLASSES } from '../../../dist/memory-class-repository.js';

export const TEST_CASE_METADATA = { title: 'preserves requested order and duplicates', prompt: { availability: 'unavailable', reason: 'Migrated existing Firestore integration coverage.' } };
export function registerRequestedOrderCase(): void { test(TEST_CASE_METADATA.title, async (): Promise<void> => { const database = createLocalFirestore(); const collection = `codaigram_test_${randomUUID().replaceAll('-', '')}`; try { for (const item of INITIAL_CLASSES) await database.collection(collection).doc(item.name).create(item); const server = createApp(new FirestoreClassRepository(database, collection)).listen(0, '127.0.0.1'); try { await new Promise<void>((resolve): void => server.once('listening', resolve)); const address = server.address(); assert.ok(address !== null && typeof address !== 'string'); const response = await fetch(`http://127.0.0.1:${String(address.port)}/api/classesDetails`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classNames: ['Class', 'Missing', 'ClassDiagram', 'Class'] }) }); const result = await response.json() as readonly { readonly name: string }[]; assert.deepEqual(result.map((item): string => item.name), ['Class', 'ClassDiagram', 'Class']); } finally { await new Promise<void>((resolve, reject): void => server.close((error?: Error): void => error === undefined ? resolve() : reject(error))); } } finally { await database.terminate(); } }); }
