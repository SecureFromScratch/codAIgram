import { LoggedError, ThrownError, ThrownValue, VariableError } from './exceptions.js';

export function logAndThrow(error: Error): never {
  throw error;
}

export function raiseExample(kind: number): void {
  if (kind === 1) throw new ThrownError();
  if (kind === 2) logAndThrow(new LoggedError());
  if (kind === 3) {
    const error: VariableError = new VariableError();
    throw error;
  }
  if (kind === 4) throw new ThrownValue();
}
