import { describe, expect, it } from "vitest"
import { analyzerCount, builderCount, costUsd, DEFAULTS, MODELS, modelForRound, testerCount } from "./config"

describe("analyzerCount", () => {
  it.each([
    [0, 1],
    [60_000, 1],
    [60_001, 2],
    [180_000, 3],
    [10_000_000, 4],
  ])("%i tokens → %i analyzers", (tokens, expected) => {
    expect(analyzerCount(tokens)).toBe(expected)
  })
})

describe("builderCount", () => {
  it.each([
    [5, 0, 4, 4],
    [1, 0, 4, 1],
    [0, 2, 4, 2],
    [0, 0, 4, 0],
  ])("%i ready + %i busy, max %i → %i builders", (ready, busy, max, expected) => {
    expect(builderCount(ready, busy, max)).toBe(expected)
  })
})

describe("testerCount", () => {
  it.each([
    [4, 2, 2],
    [3, 2, 2],
    [1, 2, 1],
    [0, 2, 1],
    [6, 4, 3],
  ])("%i builders, max %i → %i testers", (builders, max, expected) => {
    expect(testerCount(builders, max)).toBe(expected)
  })
})

describe("modelForRound", () => {
  it("uses the default model for rounds 1–2 and the strong model for rounds 3–4", () => {
    expect([1, 2, 3, 4].map(modelForRound)).toEqual([MODELS.default, MODELS.default, MODELS.strong, MODELS.strong])
  })

  it.each([0, 5, 1.5])("rejects round %s", (round) => {
    expect(() => modelForRound(round)).toThrow(RangeError)
  })
})

describe("costUsd", () => {
  it("prices haiku-5-5 per million tokens", () => {
    // 100k input × $0.10/M + 1M output × $0.50/M, below the long-context threshold.
    expect(costUsd("claude-haiku-5-5", 100_000, 1_000_000)).toBeCloseTo(0.51)
  })

  it("charges haiku-5-5 five times more above 100k input tokens", () => {
    expect(costUsd("claude-haiku-5-5", 100_000, 0)).toBeCloseTo(0.01)
    expect(costUsd("claude-haiku-5-5", 100_001, 0)).toBeCloseTo(0.0500005)
  })

  it("prices sonnet-5-5 without a long-context multiplier", () => {
    expect(costUsd("claude-sonnet-5-5", 200_000, 10_000)).toBeCloseTo(0.5)
  })

  it("throws for a model without pricing", () => {
    expect(() => costUsd("claude-haiku-4-5", 1, 1)).toThrow(/no pricing/)
  })
})

describe("DEFAULTS", () => {
  it("matches architecture.md §9", () => {
    expect(DEFAULTS).toMatchObject({
      maxBuilders: 4,
      maxAnalyzers: 4,
      maxRounds: 4,
      builderRoundTimeoutMs: 600_000,
      testerUnitTimeoutMs: 480_000,
      testsWaitTimeoutMs: 600_000,
      rescaleIntervalMs: 60_000,
    })
  })
})
