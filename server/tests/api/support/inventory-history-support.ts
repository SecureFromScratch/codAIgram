import assert from 'node:assert/strict';
import type { Server } from 'node:net';
import { createApp } from '../../../dist/app.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { loggedFetch } from '../../../dist/server_utils.js';
import type { TestDetails } from '../../../dist/memory-repository.js';

export const INITIAL_TESTS: TestDetails[] = [
    {
      group: 'model',
      name: 'keep',
      description: 'kept',
      prompt: 'keep prompt'
    },
    {
      group: 'model',
      name: 'edit',
      description: 'original',
      prompt: 'first prompt'
    },
  ];

export const UPDATED_TESTS: TestDetails[] = [
    {
      group: 'model',
      name: 'edit',
      description: 'revised',
      prompt: 'second prompt'
    },
    {
      group: 'model',
      name: 'new',
      description: 'new',
      prompt: 'new prompt'
    },
  ];

export async function withServer(run: (base: string) => Promise<void>): Promise<void> {
    const server: ReturnType<ReturnType<typeof createApp>['listen']> = createApp(new MemoryClassRepository()).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address: ReturnType<Server['address']> = server.address();
    assert.ok(address && typeof address !== 'string');
    try { await run(`http://127.0.0.1:${address.port}/api`); }
    finally { await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve())); }
  }

export async function post(base: string, route: string, body: unknown): Promise<Response> {
    return loggedFetch(`${base}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
