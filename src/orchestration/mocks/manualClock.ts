import type { Clock } from "../timeouts"

// A clock that only moves when a test calls advance(), so timeouts of 10 minutes take no time.

export type ManualClock = Clock & { advance(ms: number): void; pending(): number }

export function manualClock(): ManualClock {
  let now = 0
  let nextId = 0
  const timers = new Map<number, { due: number; fn: () => void }>()
  return {
    setTimeout(fn, ms) {
      const id = nextId++
      timers.set(id, { due: now + ms, fn })
      return () => timers.delete(id)
    },
    advance(ms) {
      const until = now + ms
      for (;;) {
        const next = [...timers.entries()].filter(([, t]) => t.due <= until).sort(([, a], [, b]) => a.due - b.due)[0]
        if (!next) break
        timers.delete(next[0])
        now = next[1].due
        next[1].fn()
      }
      now = until
    },
    pending: () => timers.size,
  }
}
