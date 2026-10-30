// Every tunable number and model name lives here (architecture.md §9). Pure values and functions,
// no Mozaik, so the domain may import this file too.

export const MODELS = {
  default: "claude-haiku-5-5",
  strong: "claude-sonnet-5-5",
} as const

export type ModelName = (typeof MODELS)[keyof typeof MODELS]

type Pricing = {
  inputPerMTok: number
  outputPerMTok: number
  // Requests with more input tokens than this cost `multiplier` times more (docs/wemora-plan.md §6).
  longContext?: { thresholdTokens: number; multiplier: number }
}

// USD per million tokens, from docs/wemora-plan.md §6.
export const PRICING: Record<ModelName, Pricing> = {
  "claude-haiku-5-5": {
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    longContext: { thresholdTokens: 100_000, multiplier: 5 },
  },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10 },
}

export const DEFAULTS = {
  maxBuilders: 4,
  maxTesters: 2,
  budgetUsd: 3,
  tokensPerAnalyzer: 60_000,
  maxAnalyzers: 4,
  maxRounds: 4,
  // Rounds from this one on use MODELS.strong.
  escalationRound: 3,
  // Our retries on top of the Anthropic SDK, which already retries each request twice by itself.
  apiRetries: 2,
  apiRetryBaseMs: 5_000,
  maxSchemaRetries: 2,
  maxPlanRetries: 2,
  rescaleIntervalMs: 60_000,
  builderRoundTimeoutMs: 10 * 60_000,
  testerUnitTimeoutMs: 8 * 60_000,
  testsWaitTimeoutMs: 10 * 60_000,
  // A screen goes to a tester at most this many times; after that it has no tests (tests.missing, D-016).
  maxTestAttempts: 2,
  // How often the Conductor checks whether a cancelled agent has really stopped before giving it a new task.
  idleCheckMs: 1_000,
} as const

// tim-plan F2: a fixed team and only the cheap rounds, until A14/A15 (F3) switch to the formulas below.
export const FIXED_TEAM = { analyzers: 1, builders: 2, testers: 1, maxRounds: 2 } as const

export function analyzerCount(totalTokens: number): number {
  const needed = Math.ceil(totalTokens / DEFAULTS.tokensPerAnalyzer)
  return Math.min(Math.max(needed, 1), DEFAULTS.maxAnalyzers)
}

export function builderCount(readyUnits: number, busyBuilders: number, maxBuilders: number): number {
  return Math.min(readyUnits + busyBuilders, maxBuilders)
}

export function testerCount(builders: number, maxTesters: number): number {
  return Math.min(Math.max(1, Math.ceil(builders / 2)), maxTesters)
}

export function modelForRound(round: number): ModelName {
  if (!Number.isInteger(round) || round < 1 || round > DEFAULTS.maxRounds) {
    throw new RangeError(`round must be an integer from 1 to ${DEFAULTS.maxRounds}, got ${round}`)
  }
  return round < DEFAULTS.escalationRound ? MODELS.default : MODELS.strong
}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model as ModelName]
  if (!pricing) throw new Error(`no pricing for model "${model}"`)
  const long = pricing.longContext
  const multiplier = long && inputTokens > long.thresholdTokens ? long.multiplier : 1
  const usd = (inputTokens * pricing.inputPerMTok + outputTokens * pricing.outputPerMTok) / 1_000_000
  return usd * multiplier
}
