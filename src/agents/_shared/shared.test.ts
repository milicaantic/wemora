import {
  createAgent,
  DeveloperMessageItem,
  FunctionCallItem,
  FunctionCallOutputItem,
  ModelContext,
  type ExecutableTransition,
  type InferenceInput,
  type InferenceOutput,
  type Tool,
} from "@mozaik-ai/core"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { PlanSchema, type RunConfig } from "../../contracts"
import { MODELS } from "../../core/config"
import { MockRunner, type MockFixture, type TaskMeta } from "../../core/runner"
import { initializeRuntime, join } from "../../core/runtime"
import { createInitialState } from "../../core/state"
import { CancelGuard, composeGuards, defineTool, freshContext, OwnershipGuard, runStructured, runTask, toModelSchema, type AgentTask } from "./index"

const Report = z.object({ screens: z.array(z.string()).min(1) })

const fixture: MockFixture = {
  "builder:guarded": [{ call: { name: "write_file", args: { path: "app/src/hack.tsx" } } }, { text: "done" }],
  "builder:cancel": [
    { call: { name: "write_file", args: { path: "staging/b1/u1/a.tsx" } } },
    { call: { name: "write_file", args: { path: "staging/b1/u1/b.tsx" } } },
    { text: "done" },
  ],
  "builder:slow": [{ text: "first" }],
  "builder:plain": [{ text: "ok" }],
  "analyzer:retry-once": [{ text: "not json" }, { json: { screens: ["home"] } }],
  "analyzer:always-bad": [{ json: { screens: [] } }, { json: {} }, { text: "{" }, { json: { screens: ["too late"] } }],
}

// Counts model calls so tests can check how many times the model was asked.
class CountingRunner extends MockRunner {
  calls = 0
  override async run(input: InferenceInput): Promise<InferenceOutput> {
    this.calls++
    return super.run(input)
  }
}

const runner = new CountingRunner(fixture)
const config: RunConfig = { webDir: "w", runDir: "r", maxBuilders: 1, maxTesters: 1, budgetUsd: 0, mock: true }

beforeAll(() => {
  initializeRuntime({ state: createInitialState("shared-test", config), inferenceRunnerConfig: { runner } })
})

let agentCount = 0
function newAgent(tools: Tool[] = [], joined = true) {
  const agent = createAgent({ name: `agent-${++agentCount}`, capabilities: [], instruction: "test agent", tools, handlers: [] })
  if (joined) join(agent)
  return agent
}

function taskFor(meta: Omit<TaskMeta, "agentId">, extra: Partial<AgentTask> = {}): AgentTask {
  return { prompt: "You are a test agent.", message: "Do the task.", meta: { agentId: "a", ...meta }, model: MODELS.default, maxOutputTokens: 500, ...extra }
}

// A pending write_file call, as the guard sees it right before the tool runs.
function writeCall(path: unknown, args?: string): ExecutableTransition {
  const call = FunctionCallItem.rehydrate({ callId: "c1", name: "write_file", args: args ?? JSON.stringify({ path }) })
  const inferenceInput = { model: MODELS.default, context: ModelContext.create() }
  return { nextStateId: "function_call", input: { call, inferenceInput } }
}

describe("OwnershipGuard", () => {
  const guard = new OwnershipGuard("staging/b1/u1")

  it("lets writes inside the prefix through", () => {
    expect(guard.isSatisfiedBy(writeCall("staging/b1/u1/src/screens/u1/A.tsx"))).toBe(false)
    expect(guard.isSatisfiedBy(writeCall("./staging/b1/u1/a.tsx"))).toBe(false)
  })

  it.each([
    "app/src/x.tsx",
    "staging/b1/u1/../../../app/x.tsx",
    "staging\\b1\\u1\\..\\..\\..\\app\\x.tsx",
    "staging/b1/u10/x.tsx",
    "/staging/b1/u1/x.tsx",
    "C:/staging/b1/u1/x.tsx",
    "",
    42,
  ])("rejects %j", (target) => {
    expect(guard.isSatisfiedBy(writeCall(target))).toBe(true)
  })

  it("rejects arguments that are not JSON and ignores other tools", () => {
    expect(guard.isSatisfiedBy(writeCall(undefined, "{not json"))).toBe(true)
    const readCall = FunctionCallItem.rehydrate({ callId: "c2", name: "read_source", args: JSON.stringify({ path: "app/x" }) })
    expect(guard.isSatisfiedBy({ nextStateId: "function_call", input: { call: readCall, inferenceInput: writeCall("x").input } } as ExecutableTransition)).toBe(false)
  })

  it("answers the model with a rejection and skips the tool", async () => {
    const transition = writeCall("app/x.tsx")
    const next = await guard.handle(transition)

    expect(next.nextStateId).toBe("inference")
    const items = (next.input as InferenceInput).context.getItems()
    expect(items[1]).toBeInstanceOf(FunctionCallOutputItem)
    expect((items[1] as FunctionCallOutputItem).output.text).toBe("Rejected: you may only write inside staging/b1/u1/")
  })
})

describe("OwnershipGuard with a list (folders end with /, the rest are single files)", () => {
  // What C's builder passes for the layout unit (PD3): its shared folder plus the Expo Router layout file.
  const guard = new OwnershipGuard(["shared/layout/", "app/_layout.tsx"])

  it.each(["shared/layout/Menu.tsx", "./shared/layout/nested/Tab.tsx", "app/_layout.tsx"])("lets %j through", (target) => {
    expect(guard.isSatisfiedBy(writeCall(target))).toBe(false)
  })

  it.each(["app/index.tsx", "app/_layout.tsx/../index.tsx", "shared/layouts/x.tsx", "shared/layout", "screens/list/a.tsx"])(
    "rejects %j",
    (target) => {
      expect(guard.isSatisfiedBy(writeCall(target))).toBe(true)
    },
  )

  it("names every allowed path in the rejection", async () => {
    const next = await guard.handle(writeCall("app/index.tsx"))
    const items = (next.input as InferenceInput).context.getItems()
    expect((items[1] as FunctionCallOutputItem).output.text).toBe(
      "Rejected: you may only write inside shared/layout/, app/_layout.tsx",
    )
  })
})

describe("runTask", () => {
  it("keeps a guarded agent from writing outside its folder", async () => {
    const invoke = vi.fn(async () => "written")
    const writeFile = defineTool({ name: "write_file", description: "Write a file.", args: z.object({ path: z.string() }), invoke })
    const agent = newAgent([writeFile])
    const guard = new OwnershipGuard("staging/b1/u1/")

    const result = await runTask(agent, taskFor({ kind: "builder", taskId: "guarded" }, { tools: [writeFile], guard }))

    expect(result).toEqual({ ok: true, value: "done" })
    expect(invoke).not.toHaveBeenCalled()
  })

  it("refuses a second task while the first one runs, and frees the agent afterwards", async () => {
    const agent = newAgent()
    const first = runTask(agent, taskFor({ kind: "builder", taskId: "slow" }))
    const second = await runTask(agent, taskFor({ kind: "builder", taskId: "slow" }))

    expect(second).toEqual({ ok: false, error: "agent busy" })
    expect(await first).toEqual({ ok: true, value: "first" })
    expect(await runTask(agent, taskFor({ kind: "builder", taskId: "plain" }))).toEqual({ ok: true, value: "ok" })
  })

  it("ends the loop at the next step after cancel", async () => {
    const guard = new CancelGuard()
    const invoke = vi.fn(async () => {
      guard.cancel("timeout")
      return "written"
    })
    const writeFile = defineTool({ name: "write_file", description: "Write a file.", args: z.object({ path: z.string() }), invoke })
    const agent = newAgent([writeFile])

    const result = await runTask(
      agent,
      taskFor({ kind: "builder", taskId: "cancel" }, { tools: [writeFile], guard: composeGuards(new OwnershipGuard("staging/b1/u1/"), guard) }),
    )

    expect(result).toEqual({ ok: false, error: "timeout" })
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it("turns runner errors into failed results", async () => {
    const result = await runTask(newAgent(), taskFor({ kind: "tester", taskId: "missing" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("mock: no replies for tester:missing")
  })

  it("refuses an agent that has not joined the runtime", async () => {
    const agent = newAgent([], false)
    expect(await runTask(agent, taskFor({ kind: "builder", taskId: "plain" }))).toEqual({
      ok: false,
      error: `agent ${agent.getId()} has not joined the runtime`,
    })
  })

  it("does not touch the agent's memory or leave handlers behind", async () => {
    const agent = newAgent()
    const memoryBefore = agent.getMemory().getContext().getItems().length
    const handlersBefore = agent.getHandlers().length

    await runTask(agent, taskFor({ kind: "builder", taskId: "plain" }))

    expect(agent.getMemory().getContext().getItems()).toHaveLength(memoryBefore)
    expect(agent.getHandlers()).toHaveLength(handlersBefore)
  })
})

describe("runStructured", () => {
  it("sends the schema errors back and accepts the corrected reply", async () => {
    const before = runner.calls
    const result = await runStructured(newAgent(), taskFor({ kind: "analyzer", taskId: "retry-once" }), Report)

    expect(result).toEqual({ ok: true, value: { screens: ["home"] } })
    expect(runner.calls - before).toBe(2)
  })

  it("gives up after the initial reply and two retries", async () => {
    const before = runner.calls
    const result = await runStructured(newAgent(), taskFor({ kind: "analyzer", taskId: "always-bad" }), Report)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^invalid structured output after 3 attempts: not valid JSON/)
    expect(runner.calls - before).toBe(3)
  })
})

describe("freshContext", () => {
  it("creates a new context with the prompt as the developer message", () => {
    const a = freshContext("prompt A", { agentId: "x", kind: "builder" })
    const b = freshContext("prompt A", { agentId: "x", kind: "builder" })

    expect(a.id).not.toBe(b.id)
    expect(a.getItems()).toHaveLength(1)
    expect(a.getItems()[0]).toBeInstanceOf(DeveloperMessageItem)
    expect((a.getItems()[0] as DeveloperMessageItem).content.text).toBe("prompt A")
  })
})

describe("defineTool", () => {
  const invoke = vi.fn(async ({ path }: { path: string }) => `wrote ${path}`)
  const tool = defineTool({ name: "write_file", description: "Write a file.", args: z.object({ path: z.string().min(1) }), invoke })

  it("passes valid arguments to invoke", async () => {
    expect(await tool.invoke({ path: "a.tsx" })).toBe("wrote a.tsx")
  })

  it("returns a readable error for invalid arguments without calling invoke", async () => {
    invoke.mockClear()
    const reply = await tool.invoke({ path: "" })
    expect(reply).toMatch(/^Error: invalid arguments for write_file/)
    expect(invoke).not.toHaveBeenCalled()
  })

  it("describes the arguments as a strict JSON Schema", () => {
    expect(tool.strict).toBe(true)
    expect(tool.parameters).toEqual({
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    })
  })
})

describe("toModelSchema", () => {
  it("removes keywords Anthropic strict mode rejects from the Plan schema", () => {
    const text = JSON.stringify(toModelSchema(PlanSchema))
    for (const keyword of ["$schema", "minLength", "minimum", "maximum", "oneOf", "propertyNames"]) {
      expect(text).not.toContain(`"${keyword}"`)
    }
    expect(text.match(/"minItems":\d+/g)).toEqual(['"minItems":1'])
    expect(text).toContain('"anyOf"')
  })

  it("keeps properties whose names look like keywords", () => {
    const schema = toModelSchema(z.object({ minimum: z.number().min(0) }))
    expect(schema.properties).toEqual({ minimum: { type: "number" } })
  })
})
