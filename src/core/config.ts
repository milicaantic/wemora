// Every tunable number and model name lives here (architecture.md §9). Pure values and functions,
// no Mozaik, so the domain may import this file too.

/** The models from architecture.md §12: the ones the hackathon gateway serves, both built into Mozaik (D-023). */
export const DEFAULT_MODELS = {
  default: "claude-haiku-4-5",
  strong: "claude-sonnet-4-6",
} as const

export type ModelName = string

// Another gateway may serve other models (D-018): WEMORA_MODEL_DEFAULT / WEMORA_MODEL_STRONG in .env replace them.
// Read on every access, because the CLI loads .env after this file is imported.
export const MODELS = {
  get default(): ModelName {
    return process.env.WEMORA_MODEL_DEFAULT || DEFAULT_MODELS.default
  },
  get strong(): ModelName {
    return process.env.WEMORA_MODEL_STRONG || DEFAULT_MODELS.strong
  },
}

type Pricing = { inputPerMTok: number; outputPerMTok: number }

// USD per million tokens, Anthropic list prices (D-023). The budget refuses any model that is not listed here.
export const PRICING: Record<ModelName, Pricing> = {
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
}

export const DEFAULTS = {
  maxBuilders: 4,
  maxTesters: 2,
  // Enough for Recepti with the D-023 prices and up to 4 rounds per unit.
  budgetUsd: 5,
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

// Prompt-cache prices as a share of the input price (Anthropic, 5-minute cache). A gateway may cache on its own
// (D-020), and then `input_tokens` counts only the uncached part.
export const CACHE_READ_PRICE = 0.1
export const CACHE_WRITE_PRICE = 1.25

export type CacheTokens = { readTokens: number; writeTokens: number }

/** `inputTokens` is the uncached input; cached tokens come in `cache`. */
export function costUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cache: CacheTokens = { readTokens: 0, writeTokens: 0 },
): number {
  const pricing = Object.hasOwn(PRICING, model) ? PRICING[model] : undefined
  if (!pricing) throw new Error(`no pricing for model "${model}"`)
  const input = inputTokens + cache.readTokens * CACHE_READ_PRICE + cache.writeTokens * CACHE_WRITE_PRICE
  return (input * pricing.inputPerMTok + outputTokens * pricing.outputPerMTok) / 1_000_000
}
