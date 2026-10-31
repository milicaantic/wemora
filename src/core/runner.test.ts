import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createAgent,
  FunctionCallItem,
  InputTokenDetails,
  ModelContext,
  ModelMessageItem,
  OutputTokenDetails,
  ReasoningItem,
  SituationSpecification,
  TokenUsage,
  type InferenceInput,
  type InferenceOutput,
  type SituationContext,
  type Tool,
} from "@mozaik-ai/core"
import { afterAll, describe, expect, it, vi } from "vitest"
import { MODELS } from "./config"
import {
  BudgetedRunner,
  loadMockFixture,
  loadMockFixtureDir,
  MockRunner,
  models,
  registerContext,
  WEMORA_ERROR,
  type MockFixture,
  type TaskMeta,
} from "./runner"
import { initializeRuntime, join, runLoop } from "./runtime"
import { createInitialState } from "./state"

type GenerativeModel = (typeof models)[number]

const haikuSpec = models.find((m) => m.specification.name === MODELS.default)!.specification

// A model whose endpoint runs `infer` instead of calling the API.
function fakeModel(infer: (input: InferenceInput) => Promise<InferenceOutput>): GenerativeModel {
  const endpoint = { endpointMapper: {}, infer: vi.fn(infer), stream: async function* () {} }
  return { endpoint: endpoint as unknown as GenerativeModel["endpoint"], specification: haikuSpec }
}

const usage = (input: number, output: number) =>
  new TokenUsage(input, output, input + output, new InputTokenDetails(0), new OutputTokenDetails(0))

const answer = (text: string, tokens = usage(1000, 100)): InferenceOutput => ({
  items: [ModelMessageItem.rehydrate({ text })],
  tokenUsage: tokens,
  rowResponse: null,
})

const apiError = (status: number) => Object.assign(new Error(`status ${status}`), { status })

function task(meta: TaskMeta = { agentId: "builder-1", kind: "builder", taskId: "u1", round: 1 }): InferenceInput {
  const context = ModelContext.create()
  registerContext(context, meta)
  return { model: MODELS.default, maxOutputTokens: 1000, context }
}

const textOf = (output: InferenceOutput) =>
  output.items.filter((i): i is ModelMessageItem => i.type === "message").map((i) => i.content.text)

function runnerWith(model: GenerativeModel, extra: Partial<ConstructorParameters<typeof BudgetedRunner>[0]> = {}) {
  return new BudgetedRunner({ budgetUsd: 3, onBudgetExceeded: vi.fn(), models: [model], sleep: async () => {}, ...extra })
}

describe("BudgetedRunner", () => {
  it("retries rate limits and returns the answer", async () => {
    const replies = [apiError(429), apiError(429)]
    const model = fakeModel(async () => {
      const next = replies.shift()
      if (next) throw next
      return answer("ok")
    })
    const onRateLimited = vi.fn()

    const output = await runnerWith(model, { onRateLimited }).run(task())

    expect(textOf(output)).toEqual(["ok"])
    expect(model.endpoint.infer).toHaveBeenCalledTimes(3)
    expect(onRateLimited).toHaveBeenCalledTimes(2)
  })

  it("returns an error message instead of throwing when every attempt fails", async () => {
    const model = fakeModel(async () => {
      throw apiError(529)
    })

    const output = await runnerWith(model).run(task())

    expect(textOf(output)[0]).toMatch(new RegExp(`^${WEMORA_ERROR} model call failed after 3 attempt\\(s\\): 529`))
    expect(model.endpoint.infer).toHaveBeenCalledTimes(3)
  })

  it("does not retry a bad request", async () => {
    const model = fakeModel(async () => {
      throw apiError(400)
    })

    const output = await runnerWith(model).run(task())

    expect(textOf(output)[0]).toContain(WEMORA_ERROR)
    expect(model.endpoint.infer).toHaveBeenCalledTimes(1)
  })

  it("adds an error message when the reply has no message and no tool call", async () => {
    const reasoningOnly: InferenceOutput = {
      items: [ReasoningItem.rehydrate({ content: undefined, encryptedContent: undefined, summary: [] })],
      tokenUsage: usage(10, 10),
      rowResponse: null,
    }

    const output = await runnerWith(fakeModel(async () => reasoningOnly)).run(task())

    expect(textOf(output)).toEqual([`${WEMORA_ERROR} empty output (no message and no tool call)`])
  })

  it("stops calling the model once the budget is spent and reports it once", async () => {
    // 100k input + 1M output on haiku-4-5 = $5.10, far above the $0.001 budget.
    const model = fakeModel(async () => answer("expensive", usage(100_000, 1_000_000)))
    const onBudgetExceeded = vi.fn()
    const runner = runnerWith(model, { budgetUsd: 0.001, onBudgetExceeded })

    await runner.run(task())
    const second = await runner.run(task())
    await runner.run(task())

    expect(model.endpoint.infer).toHaveBeenCalledTimes(1)
    expect(textOf(second)[0]).toMatch(new RegExp(`^${WEMORA_ERROR} budget exceeded`))
    expect(onBudgetExceeded).toHaveBeenCalledTimes(1)
    expect(runner.spentUsd()).toBeCloseTo(5.1)
  })

  it("reports usage with the agent from the registered context", async () => {
    const onUsage = vi.fn()

    await runnerWith(fakeModel(async () => answer("ok", usage(100_000, 1_000_000))), { onUsage }).run(task())

    expect(onUsage).toHaveBeenCalledWith({
      agentId: "builder-1",
      model: MODELS.default,
      inputTokens: 100_000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 1_000_000,
      usd: expect.closeTo(5.1),
    })
  })

  it("prices cache reads and writes from the provider's raw usage (D-020)", async () => {
    const onUsage = vi.fn()
    // A gateway that caches: input_tokens is only the uncached part, Mozaik adds both cache numbers together.
    const cached = new TokenUsage(10, 0, 10, new InputTokenDetails(30_000), new OutputTokenDetails(0))
    const output = { ...answer("ok", cached), rowResponse: { usage: { input_tokens: 10, cache_read_input_tokens: 20_000, cache_creation_input_tokens: 10_000 } } }

    await runnerWith(fakeModel(async () => output), { onUsage }).run(task())

    expect(onUsage).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 30_010, cacheReadTokens: 20_000, cacheWriteTokens: 10_000 }),
    )
    // haiku-4-5 at $1/M: 10 + 20k × 0.1 + 10k × 1.25 = 14 510 input tokens' worth.
    expect(onUsage.mock.calls[0]![0].usd).toBeCloseTo(0.01451)
  })

  it("prices every cached token as a write when the raw usage is missing", async () => {
    const onUsage = vi.fn()
    const cached = new TokenUsage(10, 0, 10, new InputTokenDetails(30_000), new OutputTokenDetails(0))

    await runnerWith(fakeModel(async () => answer("ok", cached)), { onUsage }).run(task())

    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 30_010, cacheReadTokens: 0, cacheWriteTokens: 30_000 }))
  })

  it("refuses unknown models and models without a price", async () => {
    const runner = new BudgetedRunner({ budgetUsd: 3, onBudgetExceeded: vi.fn() })

    const unknown = await runner.run({ ...task(), model: "claude-made-up" })
    const unpriced = await runner.run({ ...task(), model: "claude-opus-4-7" })

    expect(textOf(unknown)[0]).toContain('unsupported model "claude-made-up"')
    expect(textOf(unpriced)[0]).toContain('no pricing for model "claude-opus-4-7"')
  })

  it("keeps working when a callback throws", async () => {
    const onUsage = () => {
      throw new Error("ledger bug")
    }

    const output = await runnerWith(fakeModel(async () => answer("ok")), { onUsage }).run(task())

    expect(textOf(output)).toEqual(["ok"])
  })

  it("answers streaming requests with an error instead of throwing", async () => {
    const events = []
    for await (const event of new BudgetedRunner({ budgetUsd: 1, onBudgetExceeded: vi.fn() }).stream()) events.push(event)

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe("inference.output")
  })

  it("has both default models built into Mozaik, with nothing registered by us (D-023)", () => {
    const names = models.map((m) => m.specification.name)
    expect(names).toContain(MODELS.default)
    expect(names).toContain(MODELS.strong)
  })
})

describe("MockRunner", () => {
  const fixture: MockFixture = {
    builder: [{ text: "generic builder" }],
    "builder:u1": [{ call: { name: "write_file", args: { path: "src/screens/u1/index.tsx" } } }, { text: "done" }],
    "builder:u1:2": [{ text: "round two" }],
    architect: [{ json: { units: [] } }],
  }
  const runner = new MockRunner(fixture)

  it("replays the replies of the most specific key in order", async () => {
    const input = task({ agentId: "builder-1", kind: "builder", taskId: "u1", round: 1 })

    const [call] = (await runner.run(input)).items
    const done = await runner.run(input)
    const exhausted = await runner.run(input)

    expect(call).toBeInstanceOf(FunctionCallItem)
    expect(call).toMatchObject({ name: "write_file", args: JSON.stringify({ path: "src/screens/u1/index.tsx" }) })
    expect(textOf(done)).toEqual(["done"])
    expect(textOf(exhausted)[0]).toContain('replies for "builder:u1" ran out at step 3')
  })

  it("prefers kind:task:round, then kind:task, then kind", async () => {
    const round2 = await runner.run(task({ agentId: "b", kind: "builder", taskId: "u1", round: 2 }))
    const other = await runner.run(task({ agentId: "b", kind: "builder", taskId: "u9" }))

    expect(textOf(round2)).toEqual(["round two"])
    expect(textOf(other)).toEqual(["generic builder"])
  })

  it("returns json replies as message text and starts every fresh context from the first reply", async () => {
    const first = await runner.run(task({ agentId: "architect", kind: "architect" }))
    const second = await runner.run(task({ agentId: "architect", kind: "architect" }))

    expect(textOf(first)).toEqual(['{"units":[]}'])
    expect(textOf(second)).toEqual(['{"units":[]}'])
  })

  it("returns an error for unknown keys and unregistered contexts", async () => {
    const unknown = await runner.run(task({ agentId: "t", kind: "tester", taskId: "u1" }))
    const unregistered = await runner.run({ model: MODELS.default, context: ModelContext.create() })

    expect(textOf(unknown)[0]).toContain("no replies for tester:u1 | tester")
    expect(textOf(unregistered)[0]).toContain("context is not registered")
  })
})

describe("loadMockFixture", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mock-fixture-"))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it("merges one file per agent owner from a folder and rejects a key in two files (D-013)", () => {
    const folder = path.join(dir, "todomvc")
    mkdirSync(folder)
    writeFileSync(path.join(folder, "analyzer.json"), JSON.stringify({ analyzer: [{ text: "a" }] }))
    writeFileSync(path.join(folder, "tester.json"), JSON.stringify({ "tester:list": [{ text: "t" }] }))
    writeFileSync(path.join(folder, "notes.txt"), "ignored")

    expect(loadMockFixtureDir(folder)).toEqual({ analyzer: [{ text: "a" }], "tester:list": [{ text: "t" }] })

    writeFileSync(path.join(folder, "zz.json"), JSON.stringify({ analyzer: [{ text: "again" }] }))
    expect(() => loadMockFixtureDir(folder)).toThrow('mock reply key "analyzer" is in both analyzer.json and zz.json')
  })

  it("loads a valid file and rejects an invalid one with its path", () => {
    const good = path.join(dir, "good.json")
    const bad = path.join(dir, "bad.json")
    writeFileSync(good, JSON.stringify(fixtureForLoop))
    writeFileSync(bad, JSON.stringify({ builder: [{ click: "x" }] }))

    expect(loadMockFixture(good)).toEqual(fixtureForLoop)
    expect(() => loadMockFixture(bad)).toThrow(`invalid mock fixture ${bad}`)
  })
})

// End to end: a real Mozaik runLoop on MockRunner, no API calls.
const fixtureForLoop: MockFixture = {
  "builder:screen-a": [{ call: { name: "write_file", args: { path: "src/screens/screen-a/index.tsx" } } }, { text: "done" }],
}

class OwnAnswer extends SituationSpecification {
  isSatisfiedBy({ event, participant }: SituationContext): boolean {
    return event.type === "model.answer" && event.producerId === participant.getId()
  }
}

describe("MockRunner inside a Mozaik loop", () => {
  it("runs a tool call and ends with the scripted answer", async () => {
    initializeRuntime({ state: createInitialState("mock-run", runConfig), inferenceRunnerConfig: { runner: new MockRunner(fixtureForLoop) } })
    const invoke = vi.fn(async ({ path: file }: { path: string }) => `wrote ${file}`)
    const writeFile: Tool = {
      type: "function",
      name: "write_file",
      description: "Write a file.",
      parameters: { type: "object", additionalProperties: false, required: ["path"], properties: { path: { type: "string" } } },
      strict: true,
      invoke,
    }
    let resolveAnswer!: (text: string) => void
    const answered = new Promise<string>((resolve) => (resolveAnswer = resolve))
    const builder = createAgent({
      name: "builder-1",
      capabilities: [],
      instruction: "You are a builder.",
      tools: [writeFile],
      handlers: [
        {
          specification: new OwnAnswer(),
          processor: { apply: ({ event }) => resolveAnswer((event.payload as { answer: ModelMessageItem }).answer.content.text) },
        },
      ],
    })
    join(builder)
    const context = ModelContext.create()
    registerContext(context, { agentId: builder.getId(), kind: "builder", taskId: "screen-a", round: 1 })

    runLoop(builder.getId(), "Build screen-a.", { model: MODELS.default, maxOutputTokens: 1000, context, tools: builder.getTools() })

    expect(await answered).toBe("done")
    expect(invoke).toHaveBeenCalledWith({ path: "src/screens/screen-a/index.tsx" })
    expect(context.getItems().map((i) => i.type)).toEqual(["message", "function_call", "function_call_output", "message"])
  })
})

const runConfig = { webDir: "examples/todomvc", runDir: "output/mock", maxBuilders: 1, maxTesters: 1, budgetUsd: 0, mock: true }
