import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../../../dist/app.js';
import { MemoryClassRepository } from '../../../dist/memory-class-repository.js';
import { loggedFetch } from '../../../dist/server_utils.js';

export const TEST_CASE_METADATA = {
  title: 'stores source prompt history without replacing its timestamps or duplicating entries',
  prompt: {
    availability: 'available',
    history: [
      { when: '2026/11/15 09:35', text: 'prompt.old should NOT be supported in code - it was just a way to not erase that info until i feel confident with the new texts array' },
    ],
  },
};

export function registerTestPromptHistoryCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const server = createApp(new MemoryClassRepository([])).listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base: string = `http://127.0.0.1:${address.port}/api`;
    const prompts = [
      { when: '2026/11/15 09:35', text: 'First original prompt.' },
      {
        when: '2026/11/15 09:36',
        text: 'Second original prompt.'
      },
    ];
    const entry = {
      group: 'model',
      name: 'example',
      description: 'preserves prompts',
      prompt: 'Second original prompt.',
      prompts,
    };
    try {
      for (let index: number = 0; index < 2; index += 1) {
        const update: Response = await loggedFetch(`${base}/updateTests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([entry]),
        });
        assert.equal(update.status, 200);
      }
      const response: Response = await loggedFetch(`${base}/getHistory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ group: 'model', name: 'example' }]),
      });
      assert.equal(response.status, 200);
      const result = await response.json() as { prompts: { when: string; text: string }[] }[];
      assert.deepEqual(result[0]?.prompts, prompts);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => error ? reject(error) : resolve()));
    }
  });
}
