import { analyzerCount, builderCount, testerCount } from "../core/config"
import type { Clock } from "./timeouts"

// How many agents the run needs (architecture.md §9, A14), and the limit of one change per interval.

export type AgentCounts = { analyzers: number; builders: number; testers: number; reason: string }

export type CountsInput = { totalTokens: number; readyUnits: number; busyBuilders: number; maxBuilders: number; maxTesters: number }

/** The §9 formulas, with at least one builder so new work never waits for the next allowed change (D-021). */
export function planAgentCounts(input: CountsInput): AgentCounts {
  const analyzers = analyzerCount(input.totalTokens)
  const builders = Math.max(1, builderCount(input.readyUnits, input.busyBuilders, input.maxBuilders))
  const testers = testerCount(builders, input.maxTesters)
  const reason =
    `${input.readyUnits} ready + ${input.busyBuilders} busy → ${builders} builder(s) (max ${input.maxBuilders}), ` +
    `${testers} tester(s) (max ${input.maxTesters})`
  return { analyzers, builders, testers, reason }
}

/**
 * Applies at most one change per `intervalMs`. A change asked for while it waits is not lost: when the
 * interval ends, `onCooled` runs so the caller can count again with fresh numbers.
 */
export class Rescaler {
  private cooling = false
  private pending = false
  private cancelTimer: (() => void) | null = null

  constructor(
    private readonly clock: Clock,
    private readonly intervalMs: number,
    private readonly onCooled: () => void = () => {},
  ) {}

  maybeApply(next: AgentCounts, apply: (counts: AgentCounts) => void): boolean {
    if (this.cooling) {
      this.pending = true
      return false
    }
    apply(next)
    this.cooling = true
    this.cancelTimer = this.clock.setTimeout(() => {
      this.cooling = false
      this.cancelTimer = null
      if (!this.pending) return
      this.pending = false
      this.onCooled()
    }, this.intervalMs)
    return true
  }

  /** Stops the interval timer, e.g. when the run ends. */
  stop(): void {
    this.cancelTimer?.()
    this.cancelTimer = null
    this.pending = false
  }
}
