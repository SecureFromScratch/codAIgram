import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

export const TEST_CASE_METADATA = {
  title: 'logs the exact scanner upload payload, destination and response status',
  prompt: {
    availability: 'available',
    text: 'Log the attempted fetch URL and payload, including an unsuccessful HTTP response.'
  }
};

export function registerScannerHttpLogCase(): void {
  test(TEST_CASE_METADATA.title, async () => {
    const directory: string = mkdtempSync(path.join(os.tmpdir(), 'scanner-http-log-'));
    const logPath: string = path.join(directory, 'http.log');
    const server: Server = createServer((_request, response) => { response.writeHead(404); response.end(); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address: ReturnType<Server['address']> = server.address();
      assert.ok(address && typeof address !== 'string');
      const destination: string = `http://127.0.0.1:${String(address.port)}/api/updateTests`;
      const cli: string = path.resolve('dist/index.js');
      const fixture: string = path.resolve('mock-testproject');
      const exitCode: number | null = await new Promise((resolve, reject) => {
        const child: ReturnType<typeof spawn> = spawn(process.execPath, [cli, 'fixture', fixture, '--server-url', `http://127.0.0.1:${String(address.port)}`, '--logfile', logPath], { cwd: directory });
        child.stdout?.resume();
        child.stderr?.resume();
        child.once('error', reject);
        child.once('close', resolve);
      });
      assert.equal(exitCode, 2);
      const contents: string = readFileSync(logPath, 'utf8');
      assert.ok(contents.includes(`HTTP POST ${destination} payload=[`));
      assert.ok(contents.includes('"name":"initial-diagram"'));
      assert.ok(contents.includes(`HTTP POST ${destination} status=404`));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
