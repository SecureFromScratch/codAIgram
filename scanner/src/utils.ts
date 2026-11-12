import fs from 'node:fs';

type LogLevelT = 'INFO' | 'WARN' | 'ERROR';

let logFile: string = 'scanner.log';

export function initializeLog(fileName: string): void {
  logFile = fileName;
  fs.writeFileSync(logFile, '', 'utf8');
}

export function log(level: LogLevelT, message: string): void {
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${level} ${message}\n`, 'utf8');
}

export function logAndThrow(error: Error): never {
  log('WARN', error.stack ?? error.message);
  // UNTRUST-ALLOW-UNLOGGED-THROW: This utility has just recorded the complete error at warning level; throwing the same object preserves the original stack and lets the CLI boundary record fatal errors.
  throw error;
}

export async function loggedFetch(input: string | URL, options?: RequestInit, publicPayload?: string): Promise<Response> {
  const url: URL = new URL(input);
  const destination: string = `${url.origin}${url.pathname}`;
  const method: string = options?.method ?? 'GET';
  log('INFO', `HTTP ${method} ${destination} payload=${publicPayload ?? '[not logged]'}`);
  try {
    // UNTRUST-ALLOW-DIRECT-FETCH: This scanner HTTP wrapper is the single reviewed native fetch boundary and records the destination, request payload, response status and network failures.
    const response: Response = await fetch(url, options);
    log('INFO', `HTTP ${method} ${destination} status=${response.status}`);
    return response;
  } catch (error: unknown) {
    log('WARN', `HTTP ${method} ${destination} failed: ${String(error)}`);
    // UNTRUST-ALLOW-UNLOGGED-THROW: The HTTP wrapper just logged this network failure with the destination and method; rethrowing preserves the original error for the scanner entry point.
    throw error;
  }
}
