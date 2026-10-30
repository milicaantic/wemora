import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createAgent, type Tool } from "@mozaik-ai/core"
import { z } from "zod"
import { ScenarioSchema, type ExtractInteractive, type InteractiveElement, type Scenario, type Unit, type ValidateScenario } from "../contracts"
import { MODELS } from "../core/config"
import { log } from "../core/log"
import { board, emit } from "../core/runtime"
import {
  ariaSnapshot,
  coverageNote,
  extractInteractive,
  readTests,
  scenarioProblem,
  testerBrief,
  validateScenario,
  writeTests,
} from "../scenarios"
import { CancelGuard, defineTool, runTask, type AgentHandle, type TestTask } from "./_shared"

// Tester agent (architecture.md §4, step 7): looks only at the original, writes scenarios and keeps the
// ones that pass validateScenario in tests/<unitId>.json. The checks live in scenarios/; this file only
// wires them to Mozaik.

export const TESTER_MAX_OUTPUT_TOKENS = 4000
// A long page would fill the context; the start of the snapshot is what the screen is about.
const MAX_SNAPSHOT_CHARS = 30_000

export type TesterDeps = {
  /** The running original web app. */
  originalUrl: string
  /** The blank mobile app from scaffold(); a scenario must fail there (validateScenario, rule 2). */
  blankUrl: string
  // Replaceable so tests run without a browser.
  validateScenario?: ValidateScenario
  extractInteractive?: ExtractInteractive
  ariaSnapshot?: (url: string, route: string) => Promise<string>
}

type Task = {
  unit: Unit
  saved: Scenario[]
  interactive: InteractiveElement[]
  // Scenarios (as JSON) that passed try_scenario in this task, so save_scenario does not run them again.
  validated: Set<string>
}

const PROMPT_FILE = fileURLToPath(new URL("./prompts/tester.md", import.meta.url))
let prompt: string | null = null
const testerPrompt = () => (prompt ??= readFileSync(PROMPT_FILE, "utf8"))

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
const scenarioArgs = z.strictObject({ scenario: ScenarioSchema })

export function createTester(id: string, deps: TesterDeps): AgentHandle<TestTask> {
  const validate = deps.validateScenario ?? validateScenario
  const extract = deps.extractInteractive ?? extractInteractive
  const snapshot = deps.ariaSnapshot ?? ariaSnapshot

  let task: Task | null = null
  let busyWith: string | null = null
  let guard: CancelGuard | null = null

  const current = () => {
    if (!task) throw new Error("No testing task is active.")
    return task
  }

  // Runs the browser-free checks first, then validateScenario on the original and the blank screen.
  async function check(scenario: Scenario): Promise<string | null> {
    const { unit, saved, validated } = current()
    const problem = scenarioProblem(scenario, unit, saved)
    if (problem) return problem
    const key = JSON.stringify(scenario)
    if (validated.has(key)) return null
    const result = await validate(deps.originalUrl, deps.blankUrl, scenario)
    if (!result.ok) return result.reason ?? "Validation failed."
    validated.add(key)
    return null
  }

  const tools: Tool[] = [
    defineTool({
      name: "aria_snapshot",
      description: "What a user sees at a path of the original web app: role, name and text of every element. Example path: /kupovina",
      args: z.strictObject({ path: z.string().min(1) }),
      invoke: async ({ path }) => {
        current()
        const text = await snapshot(deps.originalUrl, path)
        return text.length > MAX_SNAPSHOT_CHARS ? `${text.slice(0, MAX_SNAPSHOT_CHARS)}\n… (snapshot cut)` : text
      },
    }),
    defineTool({
      name: "try_scenario",
      description: "Check a scenario on the original and on a blank screen without saving it. Returns whether it is valid, and why not.",
      args: scenarioArgs,
      invoke: async ({ scenario }) => {
        const problem = await check(scenario)
        return problem ? `Invalid: ${problem}` : "Valid. Call save_scenario with exactly the same scenario to keep it."
      },
    }),
    defineTool({
      name: "save_scenario",
      description: "Save a valid scenario for this unit. An invalid scenario is not saved; you get the reason.",
      args: scenarioArgs,
      invoke: async ({ scenario }) => {
        const problem = await check(scenario)
        if (problem) return `Not saved: ${problem}`
        const active = current()
        active.saved.push(scenario)
        // Only code builds the path: a tester writes nothing but its own unit's tests file.
        writeTests(board().config.runDir, active.unit.id, active.saved)
        board().tests[active.unit.id] = [...active.saved]
        log({ agent: id, event: "tester.saved", data: { unitId: active.unit.id, scenarioId: scenario.id, obligation: scenario.obligation } })
        return `Saved "${scenario.id}". ${coverageNote(active.unit, active.saved, active.interactive)}`
      },
    }),
  ]

  const agent = createAgent({
    name: id,
    capabilities: ["test"],
    instruction: "Tester of a React web app. Each task brings its own instructions.",
    tools,
    handlers: [],
  })

  async function prepare(unitId: string): Promise<Task> {
    const unit = board().plan?.units.find((u) => u.id === unitId)
    if (!unit) throw new Error(`unit "${unitId}" is not in the plan`)
    if (unit.kind !== "screen" || !unit.route) throw new Error(`unit "${unitId}" is not a screen with a route`)
    // A second tester (after a timeout) continues from what the first one saved.
    const saved = [...(board().tests[unitId] ?? readTests(board().config.runDir, unitId))]
    let interactive: InteractiveElement[] = []
    // A route with parameters (/recepti/:id) cannot be opened as written; the brief then lists no elements.
    if (!unit.route.includes(":")) {
      try {
        interactive = await extract(deps.originalUrl, unit.route)
      } catch (error) {
        log({ agent: id, event: "tester.interactive_failed", data: { unitId, error: message(error) } })
      }
    }
    return { unit, saved, interactive, validated: new Set() }
  }

  async function test(unitId: string, cancel: CancelGuard): Promise<void> {
    let saved = 0
    try {
      task = await prepare(unitId)
      const result = await runTask(agent, {
        prompt: testerPrompt(),
        message: testerBrief(task.unit, task.interactive, task.saved),
        meta: { agentId: id, kind: "tester", taskId: unitId },
        model: MODELS.default,
        maxOutputTokens: TESTER_MAX_OUTPUT_TOKENS,
        tools,
        guard: cancel,
      })
      log({ agent: id, event: "tester.finished", data: { unitId, saved: task.saved.length, ...(result.ok ? {} : { error: result.error }) } })
    } catch (error) {
      log({ agent: id, event: "tester.failed", data: { unitId, error: message(error) } })
    } finally {
      saved = task?.saved.length ?? 0
      task = null
    }

    // Free before emitting: the Conductor may hand out the next unit from its tests.ready handler.
    busyWith = null
    guard = null
    // Partial tests are still sent (docs/tasks/b.md Q10): the Gatekeeper then marks the screen "partial".
    // With none, nothing is sent and the Conductor's timeout gives the unit to another tester.
    if (saved === 0) {
      log({ agent: id, event: "tests.none", data: { unitId } })
      return
    }
    try {
      emit("tests.ready", { unitId }, agent.getId())
    } catch (error) {
      log({ agent: id, event: "tests.emit_failed", data: { unitId, error: message(error) } })
    }
  }

  return {
    id,
    kind: "tester",
    participant: agent,
    isBusy: () => busyWith !== null,
    assign({ unitId }) {
      if (busyWith !== null) {
        log({ agent: id, event: "task.ignored", data: { unitId, reason: `busy with unit "${busyWith}"` } })
        return
      }
      busyWith = unitId
      guard = new CancelGuard()
      void test(unitId, guard).catch((error) => {
        busyWith = null
        log({ agent: id, event: "tester.crashed", data: { unitId, error: message(error) } })
      })
    },
    cancel(reason) {
      guard?.cancel(reason)
    },
  }
}
