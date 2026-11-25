import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('class scan reports an error when no classes or interfaces are found', () => {
  const temporaryDirectory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-empty-class-scan-'));
  const sourcePath: string = path.join(temporaryDirectory, 'functions.ts');
  const logPath: string = path.join(temporaryDirectory, 'scanner.log');
  writeFileSync(sourcePath, 'export function calculate(): number { return 1; }\n', 'utf8');

  try {
    const result: ReturnType<typeof spawnSync> = spawnSync(process.execPath, [
      path.resolve('dist/index.js'),
      'empty-class-fixture',
      temporaryDirectory,
      '--types',
      'class',
      '--logfile',
      logPath,
    ], { encoding: 'utf8' });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Scanner failed:[\s\S]*Class scan found no class or interface declarations/);
    assert.match(readFileSync(logPath, 'utf8'), /ERROR[\s\S]*Class scan found no class or interface declarations/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('class scan reports duplicate declaration errors to stderr and the log', () => {
  const temporaryDirectory: string = mkdtempSync(path.join(os.tmpdir(), 'codaigram-duplicate-class-scan-'));
  const firstSourcePath: string = path.join(temporaryDirectory, 'first.ts');
  const secondSourcePath: string = path.join(temporaryDirectory, 'second.ts');
  const logPath: string = path.join(temporaryDirectory, 'scanner.log');
  writeFileSync(firstSourcePath, 'export interface DuplicateDeclaration { first: string; }\n', 'utf8');
  writeFileSync(secondSourcePath, 'export interface DuplicateDeclaration { second: string; }\n', 'utf8');

  try {
    const result: ReturnType<typeof spawnSync> = spawnSync(process.execPath, [
      path.resolve('dist/index.js'),
      'duplicate-class-fixture',
      temporaryDirectory,
      '--types',
      'class',
      '--logfile',
      logPath,
    ], { encoding: 'utf8' });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Scanner failed:[\s\S]*duplicate declaration DuplicateDeclaration/);
    assert.match(readFileSync(logPath, 'utf8'), /ERROR[\s\S]*duplicate declaration DuplicateDeclaration/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
