declare global {
  interface Window {
    logAndThrow: (error: Error) => never;
  }
}

export function logAndThrow(error: Error): never {
  console.warn(error.stack ?? error.message);
  // UNTRUST-ALLOW-UNLOGGED-THROW: This function has already logged the error at warning level; throwing the same error preserves the original stack and lets the caller handle it.
  throw error;
}

export async function loggedFetch(input: string, options: RequestInit): Promise<Response> {
  const url: URL = new URL(input, window.location.href);
  const destination: string = `${url.origin}${url.pathname}`;
  const method: string = options.method ?? 'GET';
  console.info(`HTTP ${method} ${destination}`);
  try {
    // UNTRUST-ALLOW-DIRECT-FETCH: This client HTTP wrapper is the single reviewed native fetch boundary and logs the sanitized destination, request method and outcome without logging private request bodies.
    const response: Response = await fetch(input, options);
    console.info(`HTTP ${method} ${destination} status=${response.status}`);
    return response;
  } catch (error: unknown) {
    console.error(`HTTP ${method} ${destination} failed`, error);
    // UNTRUST-ALLOW-UNLOGGED-THROW: The client HTTP wrapper has already logged the request failure and rethrows the original value to preserve abort and network-error behavior for callers.
    throw error;
  }
}
