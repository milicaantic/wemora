import { analyzerCount, builderCount, DEFAULTS, testerCount } from "../core/config"
import type { Clock } from "./timeouts"

// How many agents the run needs (architecture.md §9, A14), and the limit of one change per interval.

export type AgentCounts = { analyzers: number; builders: number; testers: number; reason: string }

export type CountsInput = {
  totalTokens: number
  readyUnits: number
  busyBuilders: number
  maxBuilders: number
  maxTesters: number
  /** Screens with no tests that no tester works on (A17). */
  untestedScreens?: number
  /** Drafts the Gatekeeper holds until their tests come (A17). */
  draftsWaitingForTests?: number
}

/**
 * The §9 formulas, with at least one builder so new work never waits for the next allowed change (D-021),
 * and one tester more while screens queue up for testers and drafts wait for their tests (A17).
 */
export function planAgentCounts(input: CountsInput): AgentCounts {
  const analyzers = analyzerCount(input.totalTokens)
  const builders = Math.max(1, builderCount(input.readyUnits, input.busyBuilders, input.maxBuilders))
  const formula = testerCount(builders, input.maxTesters)
  const untested = input.untestedScreens ?? 0
  const waiting = input.draftsWaitingForTests ?? 0
  const backlog = untested >= DEFAULTS.testerBacklog && waiting > 0
  const testers = backlog ? Math.min(input.maxTesters, formula + 1) : formula
  const extra = testers > formula ? `; ${untested} screen(s) wait for a tester while ${waiting} draft(s) wait for tests → +1 tester` : ""
  const reason =
    `${input.readyUnits} ready + ${input.busyBuilders} busy → ${builders} builder(s) (max ${input.maxBuilders}), ` +
    `${testers} tester(s) (max ${input.maxTesters})${extra}`
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
