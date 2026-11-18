import type { StorageErrorCodeT } from './error-codes.js';

export class StorageError extends Error {
  readonly code: StorageErrorCodeT;

  constructor(code: StorageErrorCodeT, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}
