import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createAgent, type Tool } from "@mozaik-ai/core"
import { z } from "zod"
import {
  ScenarioSchema,
  StepSchema,
  type Coverage,
  type ExtractInteractive,
  type InteractiveElement,
  type Scenario,
  type Step,
  type Unit,
  type ValidateScenario,
} from "../contracts"
import { DEFAULTS, MODELS } from "../core/config"
import { log } from "../core/log"
import { board, emit } from "../core/runtime"
import {
  ariaSnapshot,
  computeCoverage,
  coverageNote,
  extractInteractive,
  flowAsUnit,
  flowBrief,
  openablePath,
  readFlowTests,
  readTests,
  scenarioProblem,
  testerBrief,
  validateScenario,
  writeFlowTests,
  writeTests,
} from "../scenarios"
import { CancelGuard, defineTool, runTask, type AgentHandle } from "./_shared"

// Tester agent (architecture.md §4, step 7): looks only at the original, writes scenarios and keeps the
// ones that pass validateScenario in tests/<unitId>.json. The checks live in scenarios/; this file only
// wires them to Mozaik.

export const TESTER_MAX_OUTPUT_TOKENS = 4000
// A long page would fill the context; the start of the snapshot is what the screen is about.
const MAX_SNAPSHOT_CHARS = 30_000

export type TesterDeps = {
  /** The running original web app. */
  originalUrl: string
  /**
   * The blank mobile app from scaffold(); a scenario must fail there (validateScenario, rule 2).
   * In a run this is `blankApp(...).url` from scenarios/: the Conductor starts testers right after
   * scaffold() and before any builder works, so the first task exports the untouched placeholder.
   */
  blankUrl: string | (() => Promise<string>)
  // Replaceable so tests run without a browser.
  validateScenario?: ValidateScenario
  extractInteractive?: ExtractInteractive
  ariaSnapshot?: (url: string, route: string, steps?: Step[]) => Promise<string>
  /** The tester's own time limit per unit (D-016); default DEFAULTS.testerUnitTimeoutMs. */
  unitTimeoutMs?: number
}

/**
 * What the tester can be given: a screen `{ unitId }` (TestTask), or a flow `{ flowId }` (D-022), which the
 * Conductor hands out once A adds flowId to TestTask. Wider than TestTask on purpose.
 */
export type TesterTask = { unitId?: string; flowId?: string }

// One task: a flow when flowId is set (unitId then unused), otherwise the screen unitId.
type Work = { flowId: string | null; unitId: string }

type Task = {
  /** For a flow task, the flow seen as one unit (flowAsUnit): its first unit, the flow as the only obligation. */
  unit: Unit
  flowId: string | null
  blankUrl: string
  saved: Scenario[]
  interactive: InteractiveElement[]
  // Scenarios (as JSON) that passed try_scenario in this task, so save_scenario does not run them again.
  validated: Set<string>
  // Failed try/save per obligation; at MAX_FAILURES_PER_OBLIGATION the obligation is given up.
  failures: Map<string, number>
  givenUp: Set<string>
  // Failures since the last save: ends the task once every obligation is saved or given up.
  failuresInARow: number
  // Ends the loop when there is nothing left to test (set per task).
  finish: (reason: string) => void
  finishedBecause: string | null
}

// After this many failed attempts at one obligation the tester moves on (A's inbox message 2026-10-31).
export const MAX_FAILURES_PER_OBLIGATION = 3
const MAX_LOGGED_PROBLEM_CHARS = 300

const PROMPT_FILE = fileURLToPath(new URL("./prompts/tester.md", import.meta.url))
let prompt: string | null = null
const testerPrompt = () => (prompt ??= readFileSync(PROMPT_FILE, "utf8"))

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
// What a log line is about: the flow for a flow task, the unit otherwise.
const where = (active: Task) => (active.flowId ? { flowId: active.flowId } : { unitId: active.unit.id })
const scenarioArgs = z.strictObject({ scenario: ScenarioSchema })

export function createTester(id: string, deps: TesterDeps): AgentHandle<TesterTask> {
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
    const { unit, flowId, blankUrl, saved, validated, givenUp } = current()
    if (givenUp.has(scenario.obligation)) {
      return `You gave up on obligation "${scenario.obligation}"; do not try it again. Work on what is still missing.`
    }
    const problem = scenarioProblem(scenario, unit, saved, flowId ?? undefined)
    if (problem) return problem
    const key = JSON.stringify(scenario)
    if (validated.has(key)) return null
    const result = await validate(deps.originalUrl, blankUrl, scenario)
    if (!result.ok) return result.reason ?? "Validation failed."
    validated.add(key)
    return null
  }

  // Logs why a scenario failed (the model sees the reason, the log did not), counts it for its obligation and
  // returns what to tell the model next: move on after MAX_FAILURES_PER_OBLIGATION, or nothing.
  function failed(tool: "try_scenario" | "save_scenario", scenario: Scenario, problem: string): string {
    const active = current()
    log({
      agent: id,
      event: tool === "try_scenario" ? "tester.try_failed" : "tester.save_failed",
      data: { ...where(active), scenarioId: scenario.id, obligation: scenario.obligation, problem: problem.slice(0, MAX_LOGGED_PROBLEM_CHARS) },
    })
    active.failuresInARow++
    let note = ""
    // Only an obligation that still has no test can be given up: a failed scenario for an element may name an
    // obligation that is already covered, and giving that up would refuse every later try.
    const open = openObligations(active).includes(scenario.obligation)
    const count = (active.failures.get(scenario.obligation) ?? 0) + 1
    active.failures.set(scenario.obligation, count)
    if (open && count >= MAX_FAILURES_PER_OBLIGATION) {
      active.givenUp.add(scenario.obligation)
      log({ agent: id, event: "tester.obligation_skipped", data: { ...where(active), obligation: scenario.obligation, failures: count } })
      const next = openObligations(active)
      note = `\nGive up on obligation "${scenario.obligation}" after ${count} failed attempts and move to the next one${next.length > 0 ? `: ${next.join(", ")}` : ""}.`
      // The failures so far were for obligations: the elements get their own attempts (A's inbox 2026-10-31).
      if (next.length === 0) active.failuresInARow = 0
    }
    const end = finishIfDone(active)
    return note + (end || elementsNote(active))
  }

  // Once no obligation is open, what still has no test, so the tester covers it instead of stopping.
  function elementsNote(active: Task): string {
    if (openObligations(active).length > 0) return ""
    const missing = computeCoverage(active.unit, active.saved, active.interactive).elements.missing
    if (missing.length === 0) return ""
    const covered = active.unit.obligations.map((o) => o.id).filter((o) => !active.givenUp.has(o))
    return (
      `\nEvery obligation is covered or given up, but these elements have no test yet: ${missing.map((e) => `${e.role} "${e.name}"`).join(", ")}. ` +
      `Write one scenario that taps or fills each${covered.length > 0 ? ` (obligation: one that already has a test, e.g. ${covered[0]})` : ""}, then save it.`
    )
  }

  // Obligations without a saved scenario that were not given up.
  function openObligations(active: Task): string[] {
    return computeCoverage(active.unit, active.saved, active.interactive).obligations.missing.filter((o) => !active.givenUp.has(o))
  }

  // Ends the task when every obligation is saved or given up, and the elements are covered or the model keeps
  // failing; the tester then sends what it saved instead of waiting for its time limit.
  function finishIfDone(active: Task): string {
    if (openObligations(active).length > 0) return ""
    const elementsLeft = computeCoverage(active.unit, active.saved, active.interactive).elements.missing.length
    if (elementsLeft > 0 && active.failuresInARow < MAX_FAILURES_PER_OBLIGATION) return ""
    active.finish("every obligation is saved or given up")
    return "\nEvery obligation is saved or given up, so the task ends now."
  }

  // A flow scenario without flowId is the most common slip and cost one of three attempts; the task knows the flow.
  function withTaskFlowId(scenario: Scenario): Scenario {
    const { flowId } = current()
    return flowId && scenario.flowId === undefined ? { ...scenario, flowId } : scenario
  }

  const tools: Tool[] = [
    defineTool({
      name: "aria_snapshot",
      description:
        "What a user sees at a path of the original web app: role, name and text of every element. Example path: /kupovina. " +
        "With steps (tap, fill, submit), they run after opening the path, so you see what appears only after a tap.",
      args: z.strictObject({ path: z.string().min(1), steps: z.array(StepSchema).optional() }),
      invoke: async ({ path, steps }) => {
        current()
        const text = await snapshot(deps.originalUrl, path, steps ?? [])
        return text.length > MAX_SNAPSHOT_CHARS ? `${text.slice(0, MAX_SNAPSHOT_CHARS)}\n… (snapshot cut)` : text
      },
    }),
    defineTool({
      name: "try_scenario",
      description: "Check a scenario on the original and on a blank screen without saving it. Returns whether it is valid, and why not.",
      args: scenarioArgs,
      invoke: async (args) => {
        const scenario = withTaskFlowId(args.scenario)
        const problem = await check(scenario)
        if (problem) return `Invalid: ${problem}${failed("try_scenario", scenario, problem)}`
        return "Valid. Call save_scenario with exactly the same scenario to keep it."
      },
    }),
    defineTool({
      name: "save_scenario",
      description: "Save a valid scenario for this unit. An invalid scenario is not saved; you get the reason.",
      args: scenarioArgs,
      invoke: async (args) => {
        const scenario = withTaskFlowId(args.scenario)
        const problem = await check(scenario)
        if (problem) return `Not saved: ${problem}${failed("save_scenario", scenario, problem)}`
        const active = current()
        active.saved.push(scenario)
        active.failuresInARow = 0
        // Only code builds the path: a tester writes nothing but its own unit's (or flow's) tests file.
        const { runDir } = board().config
        if (active.flowId) {
          writeFlowTests(runDir, active.flowId, active.saved)
          board().flowTests[active.flowId] = [...active.saved]
        } else {
          writeTests(runDir, active.unit.id, active.saved)
          board().tests[active.unit.id] = [...active.saved]
        }
        log({ agent: id, event: "tester.saved", data: { ...where(active), scenarioId: scenario.id, obligation: scenario.obligation } })
        return `Saved "${scenario.id}". ${coverageNote(active.unit, active.saved, active.interactive)}${finishIfDone(active)}`
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

  // A screen task opens the screen to list its elements; a flow task (D-022) has no elements to cover.
  async function prepare(work: Work, cancel: CancelGuard): Promise<Task> {
    const plan = board().plan
    let unit: Unit
    let saved: Scenario[]
    let interactive: InteractiveElement[] = []
    if (work.flowId) {
      const flow = plan?.flows.find((f) => f.id === work.flowId)
      if (!plan || !flow) throw new Error(`flow "${work.flowId}" is not in the plan`)
      unit = flowAsUnit(flow, plan)
      saved = [...(board().flowTests[flow.id] ?? readFlowTests(board().config.runDir, flow.id))]
    } else {
      const found = plan?.units.find((u) => u.id === work.unitId)
      if (!found) throw new Error(`unit "${work.unitId}" is not in the plan`)
      if (found.kind !== "screen" || !found.route) throw new Error(`unit "${work.unitId}" is not a screen with a route`)
      unit = found
      // A second tester (after a timeout) continues from what the first one saved.
      saved = [...(board().tests[unit.id] ?? readTests(board().config.runDir, unit.id))]
    }
    // Without a blank screen no scenario can be validated, so the task stops before asking the model.
    const blankUrl = typeof deps.blankUrl === "string" ? deps.blankUrl : await deps.blankUrl()
    // A route with parameters (/recepti/:id) cannot be opened as written; the brief then lists no elements.
    const open = work.flowId || !unit.route ? null : openablePath(unit.route)
    if (open !== null) {
      try {
        interactive = await extract(deps.originalUrl, open)
      } catch (error) {
        log({ agent: id, event: "tester.interactive_failed", data: { unitId: unit.id, error: message(error) } })
      }
    }
    const prepared: Task = {
      unit,
      flowId: work.flowId,
      blankUrl,
      saved,
      interactive,
      validated: new Set(),
      failures: new Map(),
      givenUp: new Set(),
      failuresInARow: 0,
      // The own CancelGuard ends the loop at its next step; it is not a cancel from outside, so the result is sent.
      finish: (reason) => {
        prepared.finishedBecause ??= reason
        cancel.cancel(reason)
      },
      finishedBecause: null,
    }
    return prepared
  }

  function brief(active: Task): string {
    const plan = board().plan
    const flow = active.flowId ? plan?.flows.find((f) => f.id === active.flowId) : undefined
    if (plan && flow) return flowBrief(flow, plan, board().tests, active.saved)
    return testerBrief(active.unit, active.interactive, active.saved)
  }

  // The Conductor cancels from outside after its own timeout or at the end of the run (D-016).
  let cancelledFromOutside = false

  async function test(work: Work, cancel: CancelGuard): Promise<void> {
    const ids = work.flowId ? { flowId: work.flowId } : { unitId: work.unitId }
    let saved = 0
    let coverage: Coverage | null = null
    // The tester's own limit (D-016) comes before the Conductor's, so the task ends with what it saved.
    const ownLimit = setTimeout(() => cancel.cancel("tester time limit"), deps.unitTimeoutMs ?? DEFAULTS.testerUnitTimeoutMs)
    try {
      task = await prepare(work, cancel)
      const result = await runTask(agent, {
        prompt: testerPrompt(),
        message: brief(task),
        meta: { agentId: id, kind: "tester", taskId: work.flowId ?? work.unitId },
        model: MODELS.default,
        maxOutputTokens: TESTER_MAX_OUTPUT_TOKENS,
        tools,
        guard: cancel,
      })
      const end = result.ok ? {} : task.finishedBecause ? { reason: task.finishedBecause } : { error: result.error }
      log({ agent: id, event: "tester.finished", data: { ...ids, saved: task.saved.length, givenUp: [...task.givenUp], ...end } })
    } catch (error) {
      log({ agent: id, event: "tester.failed", data: { ...ids, error: message(error) } })
    } finally {
      clearTimeout(ownLimit)
      saved = task?.saved.length ?? 0
      if (task && saved > 0 && !work.flowId) coverage = computeCoverage(task.unit, task.saved, task.interactive)
      task = null
    }

    // Free before emitting: the Conductor may hand out the next task from its tests.ready handler.
    const cancelled = cancelledFromOutside
    busyWith = null
    guard = null
    cancelledFromOutside = false
    // A cancelled task sends no result (handle.ts, D-016); what it saved stays for the next tester.
    if (cancelled) {
      log({ agent: id, event: "tester.cancelled", data: { ...ids, saved } })
      return
    }
    // Partial tests are still sent (docs/tasks/b.md Q10): the Gatekeeper then marks the screen "partial".
    // With none, nothing is sent: a screen goes to another tester after the Conductor's timeout, and a flow
    // without tests is not run (the report says it was not checked).
    if (saved === 0 || (!work.flowId && !coverage)) {
      log({ agent: id, event: "tests.none", data: ids })
      return
    }
    try {
      if (work.flowId) {
        emit("flow.tests.ready", { flowId: work.flowId }, agent.getId())
      } else {
        // The Gatekeeper computes the screen status from this coverage, so it goes on the board first.
        board().coverage[work.unitId] = coverage!
        emit("tests.ready", { unitId: work.unitId }, agent.getId())
      }
    } catch (error) {
      log({ agent: id, event: "tests.emit_failed", data: { ...ids, error: message(error) } })
    }
  }

  return {
    id,
    kind: "tester",
    participant: agent,
    isBusy: () => busyWith !== null,
    assign(input: TesterTask) {
      const work: Work | null = input.flowId ? { flowId: input.flowId, unitId: "" } : input.unitId ? { flowId: null, unitId: input.unitId } : null
      if (!work) {
        log({ agent: id, event: "task.ignored", data: { reason: "the task has neither unitId nor flowId" } })
        return
      }
      const label = work.flowId ? `flow ${work.flowId}` : `unit ${work.unitId}`
      if (busyWith !== null) {
        log({ agent: id, event: "task.ignored", data: { ...input, reason: `busy with ${busyWith}` } })
        return
      }
      busyWith = label
      guard = new CancelGuard()
      void test(work, guard).catch((error) => {
        busyWith = null
        log({ agent: id, event: "tester.crashed", data: { ...input, error: message(error) } })
      })
    },
    cancel(reason) {
      if (!guard) return
      cancelledFromOutside = true
      guard.cancel(reason)
    },
  }
}
