// Timers for the Conductor (A13). Time comes from a Clock so tests can move it forward instead of waiting.

export type Clock = { setTimeout(fn: () => void, ms: number): () => void }

export const realClock: Clock = {
  setTimeout(fn, ms) {
    const timer = setTimeout(fn, ms)
    return () => clearTimeout(timer)
  },
}

/** One running timer per key (e.g. "tests:recipe-list"); starting a key again replaces its timer. */
export class Timers {
  private readonly cancels = new Map<string, () => void>()

  constructor(private readonly clock: Clock) {}

  start(key: string, ms: number, onTimeout: () => void): void {
    this.clear(key)
    const cancel = this.clock.setTimeout(() => {
      this.cancels.delete(key)
      onTimeout()
    }, ms)
    this.cancels.set(key, cancel)
  }

  clear(key: string): void {
    this.cancels.get(key)?.()
    this.cancels.delete(key)
  }

  clearAll(): void {
    for (const cancel of this.cancels.values()) cancel()
    this.cancels.clear()
  }

  has(key: string): boolean {
    return this.cancels.has(key)
  }
}
