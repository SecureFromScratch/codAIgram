export interface WaitTimer {
    dispose(): void;
}

export type WaitTimerSchedulerT = (callback: () => void, delayMs: number) => WaitTimer;

export function scheduleEditorWaitTimeout(callback: () => void, delayMs: number): WaitTimer {
    const timer: NodeJS.Timeout = setTimeout(callback, delayMs);
    return { dispose: () => clearTimeout(timer) };
}

export class PendingEditorWaits {
    readonly #timers: Map<string, WaitTimer> = new Map<string, WaitTimer>();
    readonly #onTimeout: (id: string) => void;
    readonly #schedule: WaitTimerSchedulerT;

    constructor(onTimeout: (id: string) => void, schedule: WaitTimerSchedulerT) {
        this.#onTimeout = onTimeout;
        this.#schedule = schedule;
    }

    get size(): number { return this.#timers.size; }
    has(id: string): boolean { return this.#timers.has(id); }
    add(id: string): void {
        if (this.#timers.has(id)) return;
        const timer: WaitTimer = this.#schedule(() => {
            if (this.#timers.get(id) !== timer) return;
            this.#timers.delete(id);
            this.#onTimeout(id);
        }, 30_000);
        this.#timers.set(id, timer);
    }
    delete(id: string): boolean {
        const timer: WaitTimer | undefined = this.#timers.get(id);
        if (!timer) return false;
        this.#timers.delete(id);
        timer.dispose();
        return true;
    }
    takeAll(): string[] {
        const ids: string[] = Array.from(this.#timers.keys());
        this.clear();
        return ids;
    }
    clear(): void {
        this.#timers.forEach((timer) => timer.dispose());
        this.#timers.clear();
    }
}
