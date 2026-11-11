/** The caller owns the returned timer and must cancel it on unmount or replacement. */
export function scheduleClick(callback: () => void): number { return window.setTimeout(callback, 300); }
