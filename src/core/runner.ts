import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  FunctionCallItem,
  ModelMessageItem,
  SemanticEvent,
  supportedModels,
  type InferenceInput,
  type InferenceOutput,
  type InferenceRunner,
  type ModelContext,
} from "@mozaik-ai/core"
import { z } from "zod"
import type { AgentKind } from "../contracts"
import { costUsd, DEFAULTS, PRICING, type CacheTokens } from "./config"
import { log } from "./log"

// Every model call goes through a runner from this file. Runners never throw: Mozaik's runLoop is not
// awaited, so a thrown error would crash the process (.claude/rules/mozaik.md §2). Failures come back
// as a model message that starts with WEMORA_ERROR, which ends the loop normally.

export const WEMORA_ERROR = "__WEMORA_ERROR__"

type GenerativeModel = (typeof supportedModels)[number]

// Both default models are built into Mozaik 4.1.0 (D-023), so nothing is registered here.
export const models: GenerativeModel[] = [...supportedModels]

export function errorOutput(reason: string): InferenceOutput {
  return { items: [ModelMessageItem.rehydrate({ text: `${WEMORA_ERROR} ${reason}` })], tokenUsage: undefined, rowResponse: null }
}

// Runners only see InferenceInput, so they find the agent through the task's context (registered by freshContext).
// The loop keeps adding items to the same ModelContext object, so the key stays valid for the whole task.
export type TaskMeta = { agentId: string; kind: AgentKind; taskId?: string; round?: number }

const contexts = new WeakMap<ModelContext, TaskMeta>()

export function registerContext(context: ModelContext, meta: TaskMeta): void {
  contexts.set(context, meta)
}

/** `inputTokens` is all input, cached included; the cache tokens are the part of it that was cached. */
export type UsageRecord = {
  agentId: string | null
  model: string
  inputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  usd: number
}

// The provider's own usage numbers; Mozaik's TokenUsage adds cache reads and writes into one number.
const RawUsageSchema = z.object({
  cache_read_input_tokens: z.number().nonnegative().nullish(),
  cache_creation_input_tokens: z.number().nonnegative().nullish(),
})

function cacheTokensOf(output: InferenceOutput): CacheTokens {
  const raw = RawUsageSchema.safeParse((output.rowResponse as { usage?: unknown } | null | undefined)?.usage)
  if (raw.success) {
    return { readTokens: raw.data.cache_read_input_tokens ?? 0, writeTokens: raw.data.cache_creation_input_tokens ?? 0 }
  }
  // Without the raw numbers every cached token is priced as a write, so the budget never counts too little.
  return { readTokens: 0, writeTokens: output.tokenUsage?.inputTokenDetails?.cached_tokens ?? 0 }
}

export type BudgetedRunnerOptions = {
  budgetUsd: number
  /** Called once, when spending reaches the budget. The Conductor sends budget.exceeded. */
  onBudgetExceeded: () => void
  /** Called after every paid call. The Conductor fills the ledger and the log. */
  onUsage?: (usage: UsageRecord) => void
  /** Called on every 429 or 529 that reaches us (A16 lowers parallelism). */
  onRateLimited?: () => void
  /** Tests pass fake endpoints here. */
  models?: GenerativeModel[]
  maxRetries?: number
  /** Tests pass an instant sleep so backoff does not slow them down. */
  sleep?: (ms: number) => Promise<void>
}

export class BudgetedRunner implements InferenceRunner {
  private spent = 0
  private exceededReported = false

  constructor(private readonly options: BudgetedRunnerOptions) {}

  spentUsd(): number {
    return this.spent
  }

  async run(input: InferenceInput): Promise<InferenceOutput> {
    try {
      return await this.runChecked(input)
    } catch (error) {
      return errorOutput(`runner failure: ${describe(error)}`)
    }
  }

  async *stream(): AsyncGenerator<SemanticEvent> {
    yield SemanticEvent.create("inference.output", "wemora-runner", errorOutput("streaming is not supported, use streaming: false"))
  }

  private async runChecked(input: InferenceInput): Promise<InferenceOutput> {
    if (this.spent >= this.options.budgetUsd) {
      this.reportExceeded()
      return errorOutput(`budget exceeded ($${this.spent.toFixed(4)} of $${this.options.budgetUsd})`)
    }
    const model = (this.options.models ?? models).find((m) => m.specification.name === input.model)
    if (!model) return errorOutput(`unsupported model "${input.model}"`)
    // Without a price the budget cannot be enforced, so such calls are refused.
    if (!Object.hasOwn(PRICING, input.model)) return errorOutput(`no pricing for model "${input.model}"`)

    const maxRetries = this.options.maxRetries ?? DEFAULTS.apiRetries
    for (let attempt = 0; ; attempt++) {
      try {
        const output = await model.endpoint.infer(input)
        this.record(input, output)
        return ensureAnswer(output)
      } catch (error) {
        const status = statusOf(error)
        if (status === 429 || status === 529) safely(() => this.options.onRateLimited?.())
        if (!isRetryable(error) || attempt >= maxRetries) {
          return errorOutput(`model call failed after ${attempt + 1} attempt(s): ${describe(error)}`)
        }
        await (this.options.sleep ?? sleep)(DEFAULTS.apiRetryBaseMs * 2 ** attempt)
      }
    }
  }

  private record(input: InferenceInput, output: InferenceOutput): void {
    const agentId = contexts.get(input.context)?.agentId ?? null
    const usage = output.tokenUsage
    if (!usage) {
      log({ agent: agentId ?? "runner", event: "usage.missing", data: { model: input.model } })
      return
    }
    const cache = cacheTokensOf(output)
    const usd = costUsd(input.model, usage.inputTokens, usage.outputTokens, cache)
    this.spent += usd
    const record: UsageRecord = {
      agentId,
      model: input.model,
      inputTokens: usage.inputTokens + cache.readTokens + cache.writeTokens,
      cacheReadTokens: cache.readTokens,
      cacheWriteTokens: cache.writeTokens,
      outputTokens: usage.outputTokens,
      usd,
    }
    safely(() => this.options.onUsage?.(record))
    if (this.spent >= this.options.budgetUsd) this.reportExceeded()
  }

  private reportExceeded(): void {
    if (this.exceededReported) return
    this.exceededReported = true
    safely(() => this.options.onBudgetExceeded())
  }
}

// A reply with neither a message nor a tool call makes Mozaik throw "No transition rule found".
function ensureAnswer(output: InferenceOutput): InferenceOutput {
  const usable = output.items.some((item) => item.type === "function_call" || item.type === "message")
  if (usable) return output
  return { ...output, items: [...output.items, ...errorOutput("empty output (no message and no tool call)").items] }
}

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === "number" ? status : undefined
}

// Rate limits, overload, server errors and lost connections are worth retrying; bad requests and auth errors are not.
function isRetryable(error: unknown): boolean {
  const status = statusOf(error)
  if (status !== undefined) return status === 408 || status === 409 || status === 429 || status >= 500
  const name = error instanceof Error ? error.name : ""
  return /Connection|Timeout/i.test(name)
}

function describe(error: unknown): string {
  const status = statusOf(error)
  const message = error instanceof Error ? error.message : String(error)
  return status === undefined ? message : `${status} ${message}`
}

function safely(callback: () => void): void {
  try {
    callback()
  } catch (error) {
    log({ agent: "runner", event: "callback.failed", data: { message: describe(error) } })
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// MockRunner: scripted replies per agent and task, so the whole flow can run without API calls ($0).

const MockReplySchema = z.union([
  z.strictObject({ text: z.string() }),
  z.strictObject({ call: z.strictObject({ name: z.string().min(1), args: z.record(z.string(), z.unknown()) }) }),
  z.strictObject({ json: z.json() }),
])
export type MockReply = z.infer<typeof MockReplySchema>

/** Keys, most specific first: "kind:taskId:round", "kind:taskId", "kind" (e.g. "builder:recipe-list:2"). */
export const MockFixtureSchema = z.record(z.string().min(1), z.array(MockReplySchema))
export type MockFixture = z.infer<typeof MockFixtureSchema>

export function loadMockFixture(path: string): MockFixture {
  const parsed = MockFixtureSchema.safeParse(JSON.parse(readFileSync(path, "utf8")))
  if (!parsed.success) throw new Error(`invalid mock fixture ${path}: ${z.prettifyError(parsed.error)}`)
  return parsed.data
}

// One file per agent owner (D-013), e.g. src/agents/mocks/todomvc/tester.json; a key in two files is an error.
export function loadMockFixtureDir(dir: string): MockFixture {
  const merged: MockFixture = {}
  const source = new Map<string, string>()
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
    for (const [key, replies] of Object.entries(loadMockFixture(join(dir, file)))) {
      if (source.has(key)) throw new Error(`mock reply key "${key}" is in both ${source.get(key)} and ${file} (${dir})`)
      source.set(key, file)
      merged[key] = replies
    }
  }
  return merged
}

export class MockRunner implements InferenceRunner {
  // Each fresh context starts from the first reply of its key.
  private readonly steps = new WeakMap<ModelContext, number>()

  constructor(private readonly fixture: MockFixture) {}

  async run(input: InferenceInput): Promise<InferenceOutput> {
    const meta = contexts.get(input.context)
    if (!meta) return errorOutput("mock: context is not registered (create it with freshContext)")
    const keys = mockKeys(meta)
    const key = keys.find((k) => Object.hasOwn(this.fixture, k))
    if (!key) return errorOutput(`mock: no replies for ${keys.join(" | ")}`)

    const step = this.steps.get(input.context) ?? 0
    this.steps.set(input.context, step + 1)
    const reply = this.fixture[key][step]
    if (!reply) return errorOutput(`mock: replies for "${key}" ran out at step ${step + 1}`)
    return { items: [toItem(reply, `mock-${meta.agentId}-${step + 1}`)], tokenUsage: undefined, rowResponse: null }
  }

  async *stream(): AsyncGenerator<SemanticEvent> {
    yield SemanticEvent.create("inference.output", "wemora-mock", errorOutput("streaming is not supported, use streaming: false"))
  }
}

function mockKeys({ kind, taskId, round }: TaskMeta): string[] {
  const keys: string[] = [kind]
  if (taskId) keys.unshift(`${kind}:${taskId}`)
  if (taskId && round !== undefined) keys.unshift(`${kind}:${taskId}:${round}`)
  return keys
}

function toItem(reply: MockReply, callId: string) {
  if ("call" in reply) return FunctionCallItem.rehydrate({ callId, name: reply.call.name, args: JSON.stringify(reply.call.args) })
  const text = "text" in reply ? reply.text : JSON.stringify(reply.json)
  return ModelMessageItem.rehydrate({ text })
}
