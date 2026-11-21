/** The caller owns the returned timer and must cancel it on unmount or replacement. */
export function scheduleClick(callback: () => void): number { return window.setTimeout(callback, 300); }

/** The caller owns the returned timeout and must cancel it when the operation settles. */
export function scheduleTimeout(callback: () => void, delayMs: number): number { return window.setTimeout(callback, delayMs); }
