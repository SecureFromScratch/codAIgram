export function logAndThrow(error: Error): never {
  console.warn(error.message);
  // UNTRUST-ALLOW-UNLOGGED-THROW: This function has already logged the error at warning level; throwing the same error preserves the original stack for central error handling.
  throw error;
}

export async function loggedFetch(input: string | URL, options?: RequestInit): Promise<Response> {
  const url: URL = new URL(input);
  const destination: string = `${url.origin}${url.pathname}`;
  const method: string = options?.method ?? 'GET';
  console.info(`HTTP ${method} ${destination}`);
  try {
    // UNTRUST-ALLOW-DIRECT-FETCH: This server HTTP wrapper is the single reviewed native fetch boundary and logs the sanitized destination, request method and outcome without exposing private request bodies.
    const response: Response = await fetch(input, options);
    console.info(`HTTP ${method} ${destination} status=${response.status}`);
    return response;
  } catch (error: unknown) {
    console.error(`HTTP ${method} ${destination} failed`, error);
    // UNTRUST-ALLOW-UNLOGGED-THROW: The server HTTP wrapper has already logged the request failure and rethrows the original value to preserve the native error for the caller.
    throw error;
  }
}
