import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SERVER_LOG_FILE_PATH: string = resolve(import.meta.dirname, '..', '..', 'logs', 'server.log');

function describeValueShape(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'object' && !value) return 'null';
  if (Array.isArray(value)) {
    const items: unknown[] = value.map((item: unknown) => describeValueShape(item, seen));
    return { array: items };
  }
  if (typeof value !== 'object') return typeof value;
  if (seen.has(value)) return 'circular-object';
  seen.add(value);
  const properties: [string, unknown][] = Object.entries(value).map(([key, item]: [string, unknown]) => [key, describeValueShape(item, seen)]);
  return { object: properties };
}

function writeServerLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, error?: unknown): void {
  const record: {
    timestamp: string;
    level: string;
    message: string;
    error?: { name: string; message: string; stack?: string };
  } = { timestamp: new Date().toISOString(), level, message };
  if (error instanceof Error) {
    const errorRecord: { name: string; message: string; stack?: string } = { name: error.name, message: error.message };
    if (typeof error.stack === 'string') errorRecord.stack = error.stack;
    record.error = errorRecord;
  }
  mkdirSync(dirname(SERVER_LOG_FILE_PATH), { recursive: true });
  appendFileSync(SERVER_LOG_FILE_PATH, `${JSON.stringify(record)}\n`, { encoding: 'utf8' });
}

function logError(message: string, error: unknown): void {
  writeServerLog('ERROR', message, error);
}

export function logServerReady(host: string, port: number): void {
  const message: string = `HTTP server ready to accept connections at http://${host}:${String(port)}`;
  writeServerLog('INFO', message);
  console.info(message);
}

export function logServerStartupFailure(error: Error): void {
  writeServerLog('ERROR', 'HTTP server failed to listen.', error);
  console.error('HTTP server failed to listen.', error);
}

export function logValueShape(label: string, value: unknown): void {
  const shape: unknown = describeValueShape(value, new WeakSet<object>());
  writeServerLog('INFO', `${label}: ${JSON.stringify(shape)}`);
}

export function logStorageValidationIssues(kind: string, issues: readonly unknown[], documentId: string = ''): void {
  writeServerLog('ERROR', `Storage validation failed: ${JSON.stringify({ kind, documentId, issues })}`);
}

// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT
export function warnLegacyPartialField(collection: string, documentId: string): void {
  writeServerLog('WARN', `Legacy isPartial field found in stored class: ${JSON.stringify({ collection, documentId })}`);
}
// LEGACY HANDLING SHOULD BE REMOVED BY 2026/12/01 BY MIGRATING OLD STORAGE TO NEW FORMAT

export function logAndThrow(error: Error): never {
  writeServerLog('WARN', error.message, error);
  // UNTRUST-ALLOW-UNLOGGED-THROW: This function has already logged the error at warning level; throwing the same error preserves the original stack for central error handling.
  throw error;
}

export function logUnhandledRequestError(error: unknown): void {
  if (error instanceof Error) {
    writeServerLog('ERROR', 'Unhandled request error.', error);
    return;
  }
  writeServerLog('ERROR', `Unhandled non-Error request failure: ${typeof error}.`);
}

export async function loggedFetch(input: string | URL, options?: RequestInit): Promise<Response> {
  const url: URL = new URL(input);
  const destination: string = `${url.origin}${url.pathname}`;
  const method: string = options?.method ?? 'GET';
  writeServerLog('INFO', `HTTP ${method} ${destination}`);
  try {
    // UNTRUST-ALLOW-DIRECT-FETCH: This server HTTP wrapper is the single reviewed native fetch boundary and logs the sanitized destination, request method and outcome without exposing private request bodies.
    const response: Response = await fetch(input, options);
    writeServerLog('INFO', `HTTP ${method} ${destination} status=${response.status}`);
    return response;
  } catch (error: unknown) {
    logError(`HTTP ${method} ${destination} failed`, error);
    // UNTRUST-ALLOW-UNLOGGED-THROW: The server HTTP wrapper has already logged the request failure and rethrows the original value to preserve the native error for the caller.
    throw error;
  }
}
