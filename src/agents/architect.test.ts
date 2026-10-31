import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createHuman,
  SituationSpecification,
  UserMessageItem,
  type InferenceInput,
  type InferenceOutput,
  type InferenceRunner,
  type SemanticEvent,
  type SituationContext,
} from "@mozaik-ai/core"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { fallbackReports, parseApp, splitParts, validatePlan } from "../analysis"
import { PlanSchema, type ParsedApp, type Plan, type RunConfig } from "../contracts"
import { initLog } from "../core/log"
import { MockRunner, type MockFixture } from "../core/runner"
import { board, initializeRuntime, join } from "../core/runtime"
import { createInitialState } from "../core/state"
import { createArchitect } from "./architect"

// All tests that need the runtime live in this file: Mozaik allows one runtime per process.

// The runtime keeps one runner, so each test swaps the scripted replies behind it.
// It also records each fresh context (model calls per context and the task message).
class SwitchRunner implements InferenceRunner {
  current = new MockRunner({})
  calls = 0
  contexts = new Map<string, string>()

  async run(input: InferenceInput): Promise<InferenceOutput> {
    this.calls++
    if (!this.contexts.has(input.context.id)) {
      const task = input.context.getItems().find((i): i is UserMessageItem => i instanceof UserMessageItem)
      this.contexts.set(input.context.id, task?.content.text ?? "")
    }
    return this.current.run(input)
  }

  async *stream(): AsyncGenerator<SemanticEvent> {
    yield* this.current.stream()
  }

  use(fixture: MockFixture): void {
    this.current = new MockRunner(fixture)
    this.calls = 0
    this.contexts.clear()
  }
}

class PlanEvent extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "plan.ready" || event.type === "plan.failed"
  }
}

const runner = new SwitchRunner()
let planReady = 0
let planFailed = 0
let runDir = ""
let parsed: ParsedApp
let manual: Plan
let goodOutput: Omit<Plan, "routeMap">
let badOutput: Omit<Plan, "routeMap">
let architectCount = 0

const readLog = () =>
  readFileSync(path.join(runDir, "run.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { agent: string; event: string; data?: any })

// Waits until the architect is free again (plan accepted or failed).
async function finished(architect: { isBusy(): boolean }): Promise<void> {
  for (let i = 0; i < 200 && architect.isBusy(); i++) await new Promise((r) => setTimeout(r, 10))
  expect(architect.isBusy()).toBe(false)
}

function newArchitect() {
  const architect = createArchitect(`architect-${++architectCount}`)
  join(architect.participant)
  return architect
}

beforeAll(async () => {
  runDir = mkdtempSync(path.join(tmpdir(), "wemora-architect-"))
  initLog(runDir)
  const app = await parseApp("examples/recepti")
  parsed = { ...app, parts: splitParts(app, 2) }

  manual = PlanSchema.parse(JSON.parse(readFileSync("examples/recepti/wemora/plan.manual.json", "utf8")))
  const { routeMap: _, ...withoutRouteMap } = manual
  goodOutput = withoutRouteMap
  // Without the shopping-list screen: route "/kupovina" has no screen unit and the flow points nowhere.
  badOutput = {
    units: manual.units.filter((u) => u.id !== "shopping-list"),
    flows: manual.flows.filter((f) => !f.unitIds.includes("shopping-list")),
  }

  const config: RunConfig = { webDir: "examples/recepti", runDir, maxBuilders: 1, maxTesters: 1, budgetUsd: 0, mock: true }
  const state = createInitialState("architect-test", config)
  state.parsed = parsed
  for (const part of parsed.parts) state.reports[part.id] = fallbackReports(parsed, part.id, "test")
  initializeRuntime({ state, inferenceRunnerConfig: { runner } })

  join(
    createHuman({
      name: "listener",
      capabilities: [],
      handlers: [
        {
          specification: new PlanEvent(),
          processor: { apply: ({ event }) => void (event.type === "plan.ready" ? planReady++ : planFailed++) },
        },
      ],
    }),
  )
})

beforeEach(() => {
  planReady = 0
  planFailed = 0
  board().plan = null
  rmSync(path.join(runDir, "plan.json"), { force: true })
  rmSync(path.join(runDir, "plan.errors.json"), { force: true })
})

describe("architect agent", () => {
  it("accepts a valid plan: plan.json passes the schema and validatePlan, plan.ready is sent once", async () => {
    runner.use({ "architect:plan:1": [{ json: goodOutput }] })
    const architect = newArchitect()
    architect.assign({ partIds: parsed.parts.map((p) => p.id) })
    expect(architect.isBusy()).toBe(true)
    await finished(architect)

    const plan = PlanSchema.parse(JSON.parse(readFileSync(path.join(runDir, "plan.json"), "utf8")))
    expect(validatePlan(plan, parsed)).toEqual([])
    expect(plan.routeMap).toEqual(manual.routeMap)
    expect(plan.units.map((u) => u.id).sort()).toEqual(manual.units.map((u) => u.id).sort())
    expect(board().plan).toEqual(plan)
    expect(planReady).toBe(1)
    expect(planFailed).toBe(0)
    expect(runner.calls).toBe(1)
    // The brief carries the reports of every part.
    const brief = [...runner.contexts.values()][0]!
    for (const route of parsed.routes) expect(brief).toContain(`route "${route.path}"`)
  })

  it("retries in a fresh context with the validatePlan errors, then accepts the corrected plan", async () => {
    runner.use({ "architect:plan:1": [{ json: badOutput }], "architect:plan:2": [{ json: goodOutput }] })
    const architect = newArchitect()
    architect.assign({ partIds: parsed.parts.map((p) => p.id) })
    await finished(architect)

    expect(runner.calls).toBe(2)
    const messages = [...runner.contexts.values()]
    expect(messages).toHaveLength(2)
    expect(messages[0]).not.toContain("Your previous plan")
    expect(messages[1]).toContain('"/kupovina"')
    expect(messages[1]).toContain("Return the full corrected plan")
    expect(planReady).toBe(1)
    expect(existsSync(path.join(runDir, "plan.json"))).toBe(true)
    expect(readLog().some((l) => l.event === "plan.rejected" && l.data.attempt === 1)).toBe(true)
  })

  it("salvages the last plan by dropping an obligation validatePlan keeps rejecting (A: 20:24 run)", async () => {
    const stubborn = {
      ...goodOutput,
      units: goodOutput.units.map((u) =>
        u.id === "favorites"
          ? { ...u, obligations: [...u.obligations, { id: "from-the-list", description: "Tapping 'Ukloni iz omiljenih: Sarma' (added via the recipe list flow) removes it." }] }
          : u,
      ),
    }
    runner.use({ architect: [{ json: stubborn }] })
    const architect = newArchitect()
    architect.assign({ partIds: parsed.parts.map((p) => p.id) })
    await finished(architect)

    expect(runner.calls).toBe(3)
    expect(planReady).toBe(1)
    expect(planFailed).toBe(0)
    const plan = PlanSchema.parse(JSON.parse(readFileSync(path.join(runDir, "plan.json"), "utf8")))
    expect(validatePlan(plan, parsed)).toEqual([])
    expect(plan.units.find((u) => u.id === "favorites")?.obligations.map((o) => o.id)).not.toContain("from-the-list")
    const salvaged = readLog().find((l) => l.event === "plan.salvaged")
    expect(salvaged?.data.dropped).toEqual(["obligation favorites/from-the-list"])
  })

  it("gives up after three bad plans: plan.failed instead of plan.ready, plan.errors.json written, the process keeps going", async () => {
    runner.use({ architect: [{ json: badOutput }] })
    const architect = newArchitect()
    architect.assign({ partIds: parsed.parts.map((p) => p.id) })
    await finished(architect)

    expect(runner.calls).toBe(3)
    expect(runner.contexts.size).toBe(3)
    expect(planReady).toBe(0)
    expect(planFailed).toBe(1)
    expect(board().plan).toBeNull()
    expect(existsSync(path.join(runDir, "plan.json"))).toBe(false)
    const errors = JSON.parse(readFileSync(path.join(runDir, "plan.errors.json"), "utf8"))
    expect(errors.attempts).toBe(3)
    expect(errors.errors.join("\n")).toContain("/kupovina")
    expect(errors.lastPlan.units.length).toBe(badOutput.units.length)
    expect(readLog().some((l) => l.event === "plan.gave_up" && l.agent === architect.id && l.data.attempts === 3)).toBe(true)
  })

  it("normalizes the model's plan before checking it (wrong size and wave are fixed, not rejected)", async () => {
    const sloppy = { ...goodOutput, units: goodOutput.units.map((u) => ({ ...u, size: 1, wave: 7, writes: [] })) }
    runner.use({ "architect:plan:1": [{ json: sloppy }] })
    const architect = newArchitect()
    architect.assign({ partIds: parsed.parts.map((p) => p.id) })
    await finished(architect)

    expect(planReady).toBe(1)
    const plan = board().plan!
    for (const unit of manual.units) {
      expect(plan.units.find((u) => u.id === unit.id)).toMatchObject({ size: unit.size, wave: unit.wave, writes: unit.writes })
    }
  })

  it("ignores a second task while busy and on cancel sends plan.failed, not plan.ready", async () => {
    runner.use({ architect: [{ text: "not json" }, { text: "still not json" }, { text: "{" }] })
    const architect = newArchitect()
    architect.assign({ partIds: ["part-1"] })
    architect.assign({ partIds: ["part-2"] })
    architect.cancel("timeout")
    await finished(architect)

    expect(planReady).toBe(0)
    expect(planFailed).toBe(1)
    expect(runner.contexts.size).toBeLessThanOrEqual(1)
    const errors = JSON.parse(readFileSync(path.join(runDir, "plan.errors.json"), "utf8"))
    expect(errors.errors.join("\n")).toContain("timeout")
    expect(readLog().some((l) => l.event === "task.ignored" && l.agent === architect.id)).toBe(true)
  })
})
