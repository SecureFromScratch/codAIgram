import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { logAndThrow } from '../logging.js';

export type RunningLiveVscodeHostT = {
  readonly process: ChildProcessWithoutNullStreams;
  readonly connectionUrl: string;
  readonly coordinationDirectory: string;
  readonly stopFilePath: string;
  readonly diagnostics: () => string;
};

export async function startLiveVscodeHost(): Promise<RunningLiveVscodeHostT> {
  const coordinationDirectory: string = await mkdtemp(join(tmpdir(), 'codaigram-live-vscode-'));
  const readyFilePath: string = join(coordinationDirectory, 'bridge-ready.json');
  const stopFilePath: string = join(coordinationDirectory, 'stop-host');
  const runnerPath: string = resolve('codAIgram-bridge/test-dist/tests/liveVisualHostRunner.js');
  const priorHostDirectory: string | undefined = process.env.CODAIGRAM_LIVE_HOST_DIRECTORY;
  process.env.CODAIGRAM_LIVE_HOST_DIRECTORY = coordinationDirectory;
  let hostProcess: ChildProcessWithoutNullStreams;
  try {
    hostProcess = spawn(process.execPath, [runnerPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
      windowsHide: true,
    });
  } finally {
    if (priorHostDirectory) process.env.CODAIGRAM_LIVE_HOST_DIRECTORY = priorHostDirectory;
    else delete process.env.CODAIGRAM_LIVE_HOST_DIRECTORY;
  }
  let hostOutput: string = '';
  hostProcess.stdout.on('data', (chunk: Buffer) => { hostOutput = appendDiagnostic(hostOutput, chunk.toString()); });
  hostProcess.stderr.on('data', (chunk: Buffer) => { hostOutput = appendDiagnostic(hostOutput, chunk.toString()); });

  try {
    const connectionUrl: string = await waitForBridgeUrl(readyFilePath, hostProcess, () => hostOutput);
    return { 
      process: hostProcess, 
      connectionUrl, 
      coordinationDirectory, 
      stopFilePath, 
      diagnostics: () => hostOutput 
    };
  } catch (error: unknown) {
    console.error("Could not start the isolated VS Code host.", error);
    hostProcess.kill();
    await rm(coordinationDirectory, { recursive: true, force: true });
    // UNTRUST-ALLOW-UNLOGGED-THROW: The original startup error was logged before cleanup; rethrow it after deleting temporary files so the caller retains its cause and stack.
    throw error;
  }
}

export async function stopLiveVscodeHost(host: RunningLiveVscodeHostT): Promise<void> {
  await writeFile(host.stopFilePath, 'stop', 'utf8');
  const exitCode: number = await waitForHostExit(host.process);
  const diagnostics: string = host.diagnostics().trim();
  await rm(host.coordinationDirectory, { recursive: true, force: true });
  if (exitCode !== 0) {
    logAndThrow(new Error(`The isolated VS Code host exited with code ${String(exitCode)}.${diagnostics.length > 0 ? ` Host output: ${diagnostics}` : ''}`));
  }
}

async function waitForBridgeUrl(
  readyFilePath: string,
  hostProcess: ChildProcessWithoutNullStreams,
  diagnostics: () => string,
): Promise<string> {
  const deadline: number = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (existsSync(readyFilePath)) {
      const rawValue: string = await readFile(readyFilePath, 'utf8');
      const parsed: unknown = JSON.parse(rawValue);
      if (typeof parsed === 'object' && parsed && 'connectionUrl' in parsed && typeof parsed.connectionUrl === 'string') return parsed.connectionUrl;
      logAndThrow(new Error('The isolated VS Code host published an invalid bridge URL record.'));
    }
    if (typeof hostProcess.exitCode === 'number' || typeof hostProcess.signalCode === 'string') {
      logAndThrow(new Error(`The isolated VS Code host exited before publishing its bridge URL.${formatHostDiagnostics(diagnostics())}`));
    }
    await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  logAndThrow(new Error(`Timed out waiting for the isolated VS Code host to publish its bridge URL.${formatHostDiagnostics(diagnostics())}`));
}

async function waitForHostExit(hostProcess: ChildProcessWithoutNullStreams): Promise<number> {
  if (typeof hostProcess.exitCode === 'number') return hostProcess.exitCode;
  if (typeof hostProcess.signalCode === 'string') return -1;
  return new Promise<number>((resolveExit, rejectExit) => {
    const timeout: ReturnType<typeof setTimeout> = setTimeout(() => {
      hostProcess.kill();
      rejectExit(new Error('Timed out waiting for the isolated VS Code host to exit.'));
    }, 30_000);
    hostProcess.once('exit', (code: ChildProcessWithoutNullStreams['exitCode']) => {
      clearTimeout(timeout);
      resolveExit(code ?? -1);
    });
    hostProcess.once('error', (error: Error) => {
      clearTimeout(timeout);
      rejectExit(error);
    });
  });
}

function appendDiagnostic(current: string, next: string): string {
  const combined: string = `${current}${next}`;
  return combined.length > 12_000 ? combined.slice(-12_000) : combined;
}

function formatHostDiagnostics(value: string): string {
  const trimmed: string = value.trim();
  return trimmed.length > 0 ? ` Host output: ${trimmed.slice(-2_500)}` : '';
}
