import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

export const TEST_CASE_METADATA = {
  title: 'records discovered cases and fatal errors in separately named truncated logs',
  prompt: {
    availability: 'available',
    text: 'Write detected test cases and errors to a per-run scanner log, with --logfile selecting the file.'
  }
};

export function registerScannerLogCase(): void {
  test(TEST_CASE_METADATA.title, () => {
    const directory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-scanner-log-'));
    const cli: string = path.resolve('dist/index.js');
    const fixture: string = path.resolve('mock-testproject');
    const logPath: string = path.join(directory, 'selected.log');
    try {
      writeFileSync(logPath, 'previous run\n', 'utf8');
      const success: ReturnType<typeof spawnSync> = spawnSync(process.execPath, [cli, 'fixture', fixture, '--logfile', logPath], { cwd: directory, encoding: 'utf8' });
      assert.equal(success.status, 0, String(success.stderr));
      const firstRun: string = readFileSync(logPath, 'utf8');
      assert.doesNotMatch(firstRun, /previous run/);
      assert.match(firstRun, /TEST CASE model\.initial-diagram/);
      assert.match(firstRun, /DESCRIPTION|description/);
      assert.match(firstRun, /prompt/);
      const failure: ReturnType<typeof spawnSync> = spawnSync(process.execPath, [cli, 'invalid project', fixture, '--logfile', logPath], { cwd: directory, encoding: 'utf8' });
      assert.equal(failure.status, 2);
      const secondRun: string = readFileSync(logPath, 'utf8');
      assert.match(secondRun, /WARN.*Project name/s);
      assert.match(secondRun, /ERROR.*Project name/s);
      assert.doesNotMatch(secondRun, /TEST CASE model\.initial-diagram/);
      const defaultRun: ReturnType<typeof spawnSync> = spawnSync(process.execPath, [cli, 'fixture', fixture], { cwd: directory, encoding: 'utf8' });
      assert.equal(defaultRun.status, 0, String(defaultRun.stderr));
      assert.match(readFileSync(path.join(directory, 'scanner.log'), 'utf8'), /TEST CASE model\.initial-diagram/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
