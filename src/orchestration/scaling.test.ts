import { describe, expect, it, vi } from "vitest"
import { DEFAULTS } from "../core/config"
import { manualClock } from "./mocks/manualClock"
import { planAgentCounts, Rescaler, type AgentCounts } from "./scaling"

const counts = (builders: number, testers: number): AgentCounts => ({ analyzers: 1, builders, testers, reason: "test" })

describe("planAgentCounts", () => {
  it("gives TodoMVC one analyzer, one builder and one tester", () => {
    // examples/todomvc: ~3k tokens, only "layout" is ready after the plan.
    const result = planAgentCounts({ totalTokens: 3_000, readyUnits: 1, busyBuilders: 0, maxBuilders: 4, maxTesters: 2 })
    expect(result).toMatchObject({ analyzers: 1, builders: 1, testers: 1 })
  })

  it("gives Recepti four builders and two testers when five screens are ready", () => {
    const result = planAgentCounts({ totalTokens: 7_000, readyUnits: 5, busyBuilders: 0, maxBuilders: 4, maxTesters: 2 })
    expect(result).toMatchObject({ analyzers: 1, builders: 4, testers: 2 })
    expect(result.reason).toBe("5 ready + 0 busy → 4 builder(s) (max 4), 2 tester(s) (max 2)")
  })

  it("counts busy builders and adds analyzers for large apps", () => {
    const result = planAgentCounts({ totalTokens: 130_000, readyUnits: 1, busyBuilders: 2, maxBuilders: 4, maxTesters: 2 })
    expect(result).toMatchObject({ analyzers: 3, builders: 3, testers: 2 })
  })

  it("keeps one builder when nothing is ready or busy", () => {
    const result = planAgentCounts({ totalTokens: 3_000, readyUnits: 0, busyBuilders: 0, maxBuilders: 4, maxTesters: 2 })
    expect(result).toMatchObject({ builders: 1, testers: 1 })
  })
})

describe("Rescaler", () => {
  it("applies only the first of two changes within the interval", () => {
    const clock = manualClock()
    const apply = vi.fn()
    const rescaler = new Rescaler(clock, DEFAULTS.rescaleIntervalMs)

    expect(rescaler.maybeApply(counts(2, 1), apply)).toBe(true)
    clock.advance(DEFAULTS.rescaleIntervalMs - 1)
    expect(rescaler.maybeApply(counts(4, 2), apply)).toBe(false)

    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(counts(2, 1))
  })

  it("asks again when the interval ends, only if a change was refused", () => {
    const clock = manualClock()
    const onCooled = vi.fn()
    const rescaler = new Rescaler(clock, DEFAULTS.rescaleIntervalMs, onCooled)

    rescaler.maybeApply(counts(1, 1), () => {})
    clock.advance(DEFAULTS.rescaleIntervalMs)
    expect(onCooled).not.toHaveBeenCalled()

    rescaler.maybeApply(counts(2, 1), () => {})
    rescaler.maybeApply(counts(4, 2), () => {})
    clock.advance(DEFAULTS.rescaleIntervalMs)
    expect(onCooled).toHaveBeenCalledTimes(1)
    expect(rescaler.maybeApply(counts(4, 2), () => {})).toBe(true)
  })

  it("leaves no timer behind after stop", () => {
    const clock = manualClock()
    const onCooled = vi.fn()
    const rescaler = new Rescaler(clock, DEFAULTS.rescaleIntervalMs, onCooled)
    rescaler.maybeApply(counts(1, 1), () => {})
    rescaler.maybeApply(counts(2, 1), () => {})

    rescaler.stop()

    expect(clock.pending()).toBe(0)
    clock.advance(DEFAULTS.rescaleIntervalMs)
    expect(onCooled).not.toHaveBeenCalled()
  })
})
