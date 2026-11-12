export {};

declare global {
  interface Window {
    logAndThrow: (error: Error) => never;
  }
}
