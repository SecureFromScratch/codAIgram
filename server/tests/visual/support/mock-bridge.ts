import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export type MockWorkspaceT = {
  readonly name: string;
  readonly uri: string;
  readonly index: number;
};

export type RunningMockBridgeT = {
  readonly process: ChildProcessWithoutNullStreams;
  readonly connectionUrl: string;
  readonly configPath: string;
  readonly port: number;
};

type MockBridgeConfigT = {
  readonly authtoken: string;
  readonly port: number;
  readonly workspaceFolders: readonly MockWorkspaceT[];
  readonly workspaceLastModified: number;
  readonly promptResponses: readonly unknown[];
  readonly trustedOrigins: readonly string[];
};

const MOCK_TOKEN: string = 'visual-test-token';
const WORKSPACE_TIMESTAMP: number = 1_900_000_000_000;
const TRUSTED_TEST_ORIGIN: string = 'http://127.0.0.1:41731';

export async function startMockBridgeWithFolders(folders: readonly MockWorkspaceT[], port: number = 0): Promise<RunningMockBridgeT> {
  const configPath: string = join(tmpdir(), `codaigram-bridge-mock-${process.pid}-${Date.now()}.json`);
  const config: MockBridgeConfigT = {
    authtoken: MOCK_TOKEN,
    port,
    workspaceFolders: folders,
    workspaceLastModified: WORKSPACE_TIMESTAMP,
    promptResponses: [],
    trustedOrigins: [TRUSTED_TEST_ORIGIN],
  };
  writeFileSync(configPath, JSON.stringify(config), 'utf8');
  const childProcess: ChildProcessWithoutNullStreams = spawn(process.execPath, [resolve('bridge-mock/dist/main.js'), configPath], { cwd: process.cwd(), stdio: 'pipe' });
  let standardError: string = '';
  const allocatedPort: number = await new Promise<number>((resolvePort, rejectPort) => {
    let standardOutput: string = '';
    let settled: boolean = false;
    const startupTimeout: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (settled) return;
      settled = true;
      childProcess.kill();
      rejectPort(new Error('Timed out waiting for bridge-mock to start.'));
    }, 10_000);
    childProcess.stdout.on('data', (chunk: Buffer) => {
      if (settled) return;
      standardOutput += chunk.toString();
      // UNTRUST-ALLOW-NULLISH: The bridge-mock readiness expression returns null until its listener line arrives, so the process startup wait must keep buffering output.
      const match: RegExpExecArray | null = /listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(standardOutput);
      if (!match || !match[1]) return;
      settled = true;
      clearTimeout(startupTimeout);
      resolvePort(Number(match[1]));
    });
    childProcess.stderr.on('data', (chunk: Buffer) => { standardError += chunk.toString(); });
    childProcess.once('error', (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimeout);
      rejectPort(error);
    });
    childProcess.once('exit', () => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimeout);
      rejectPort(new Error(standardError || 'bridge-mock exited before it started.'));
    });
  });
  return {
    process: childProcess,
    connectionUrl: `http://127.0.0.1:${String(allocatedPort)}/${MOCK_TOKEN}`,
    configPath,
    port: allocatedPort,
  };
}

export async function stopMockBridge(mockProcess: ChildProcessWithoutNullStreams): Promise<void> {
  // UNTRUST-ALLOW-NULLISH: Node reports null exit and signal codes while a child is still running; checking both avoids killing or awaiting an already stopped mock process.
  if (mockProcess.exitCode !== null || mockProcess.signalCode !== null) return;
  mockProcess.kill();
  await new Promise<void>((resolveStop) => mockProcess.once('exit', () => resolveStop()));
}

export async function removeMockBridgeConfig(configPath: string): Promise<void> {
  unlinkSync(configPath);
}
