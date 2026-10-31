import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createAgent } from "@mozaik-ai/core"
import {
  ArchitectOutputSchema,
  architectBrief,
  architectRetryMessage,
  normalizePlan,
  validatePlan,
  type ArchitectOutput,
} from "../analysis"
import type { ParsedApp, Plan } from "../contracts"
import { DEFAULTS, MODELS } from "../core/config"
import { log } from "../core/log"
import { board, emit } from "../core/runtime"
import { CancelGuard, runStructured, type AgentHandle, type ArchitectTask } from "./_shared"

// Architect agent (architecture.md §4, step 4): turns all analyzer reports into a Plan.
// The model proposes; normalizePlan fixes what code knows better; validatePlan decides.
// Each attempt runs in a fresh context (runStructured makes one), with the errors of the last one.

export const ARCHITECT_MAX_OUTPUT_TOKENS = 16_000
/** TaskMeta.taskId of the architect's work; the attempt number goes into TaskMeta.round. */
export const ARCHITECT_TASK_ID = "plan"

const PROMPT_FILE = fileURLToPath(new URL("./prompts/architect.md", import.meta.url))
let prompt: string | null = null
const architectPrompt = () => (prompt ??= readFileSync(PROMPT_FILE, "utf8"))

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

type PlanOutcome = { ok: true; plan: Plan; attempts: number } | { ok: false; attempts: number; errors: string[]; lastPlan: ArchitectOutput | null }

export function createArchitect(id: string): AgentHandle<ArchitectTask> {
  let busy = false
  let guard: CancelGuard | null = null

  const agent = createAgent({
    name: id,
    capabilities: ["plan"],
    instruction: "Architect of a React → Expo migration. Each task brings its own instructions.",
    tools: [],
    handlers: [],
  })

  async function makePlan(partIds: string[], cancel: CancelGuard): Promise<PlanOutcome> {
    const state = board()
    const parsed = state.parsed
    if (!parsed) throw new Error("the board has no parsed app (board().parsed is null)")
    const missing = partIds.filter((p) => !state.reports[p])
    if (missing.length > 0) log({ agent: id, event: "plan.missing_reports", data: { partIds: missing } })
    const brief = architectBrief(parsed, partIds.flatMap((p) => state.reports[p] ?? []))

    const maxAttempts = 1 + DEFAULTS.maxPlanRetries
    let request = brief
    let errors: string[] = []
    let lastPlan: ArchitectOutput | null = null
    // The last plan that passed the schema, and what validatePlan said about it (for salvagePlan).
    let lastChecked: { plan: Plan; errors: string[] } | null = null
    let attempt = 0
    while (attempt < maxAttempts && !cancel.isCancelled()) {
      attempt++
      const result = await runStructured(
        agent,
        {
          prompt: architectPrompt(),
          message: request,
          meta: { agentId: id, kind: "architect", taskId: ARCHITECT_TASK_ID, round: attempt },
          model: MODELS.strong,
          maxOutputTokens: ARCHITECT_MAX_OUTPUT_TOKENS,
          guard: cancel,
        },
        ArchitectOutputSchema,
      )
      if (result.ok) {
        const plan = normalizePlan(result.value, parsed)
        errors = validatePlan(plan, parsed)
        if (errors.length === 0) return { ok: true, plan, attempts: attempt }
        lastPlan = result.value
        lastChecked = { plan, errors }
        request = architectRetryMessage(brief, result.value, errors)
      } else {
        // No usable JSON (or an API error / cancel): ask again from the brief, keeping the last real plan if any.
        errors = [result.error]
        request = lastPlan ? architectRetryMessage(brief, lastPlan, errors) : brief
      }
      log({ agent: id, event: "plan.rejected", data: { attempt, errors } })
    }
    if (lastChecked && !cancel.isCancelled()) {
      const salvaged = salvagePlan(lastChecked.plan, lastChecked.errors, parsed)
      if (salvaged) {
        log({ agent: id, event: "plan.salvaged", data: { attempts: attempt, dropped: salvaged.dropped } })
        return { ok: true, plan: salvaged.plan, attempts: attempt }
      }
    }
    return { ok: false, attempts: attempt, errors, lastPlan }
  }

  function writeJson(file: string, data: unknown): void {
    const runDir = board().config.runDir
    mkdirSync(runDir, { recursive: true })
    writeFileSync(path.join(runDir, file), `${JSON.stringify(data, null, 2)}\n`)
  }

  function succeed(plan: Plan, attempts: number): void {
    try {
      board().plan = plan
      writeJson("plan.json", plan)
    } catch (error) {
      log({ agent: id, event: "plan.write_failed", data: { error: message(error) } })
    }
    log({ agent: id, event: "plan.accepted", data: { attempts, units: plan.units.length } })
    busy = false
    guard = null
    try {
      emit("plan.ready", {}, agent.getId())
    } catch (error) {
      log({ agent: id, event: "plan.emit_failed", data: { error: message(error) } })
    }
  }

  // plan.failed (D-012) carries no data: the errors go to the log and to plan.errors.json, and
  // board().plan stays null. The Conductor ends the run and still builds the report.
  function fail(attempts: number, errors: string[], lastPlan: ArchitectOutput | null): void {
    log({ agent: id, event: "plan.gave_up", data: { attempts, errors } })
    try {
      writeJson("plan.errors.json", { attempts, errors, lastPlan })
    } catch (error) {
      log({ agent: id, event: "plan.write_failed", data: { error: message(error) } })
    }
    busy = false
    guard = null
    try {
      emit("plan.failed", {}, agent.getId())
    } catch (error) {
      log({ agent: id, event: "plan.emit_failed", data: { error: message(error) } })
    }
  }

  async function run(partIds: string[], cancel: CancelGuard): Promise<void> {
    let outcome: PlanOutcome
    try {
      outcome = await makePlan(partIds, cancel)
    } catch (error) {
      outcome = { ok: false, attempts: 0, errors: [message(error)], lastPlan: null }
    }
    if (outcome.ok) succeed(outcome.plan, outcome.attempts)
    else fail(outcome.attempts, outcome.errors, outcome.lastPlan)
  }

  return {
    id,
    kind: "architect",
    participant: agent,
    isBusy: () => busy,
    assign({ partIds }) {
      if (busy) {
        log({ agent: id, event: "task.ignored", data: { partIds, reason: "busy with a plan" } })
        return
      }
      busy = true
      guard = new CancelGuard()
      void run(partIds, guard).catch((error) => {
        busy = false
        log({ agent: id, event: "plan.crashed", data: { error: message(error) } })
      })
    },
    cancel(reason) {
      guard?.cancel(reason)
    },
  }
}

/**
 * After the last attempt: drops the obligations and movedTo differences that validatePlan names, and checks
 * again, so one stubborn rule does not end the whole run without a plan. Null when another kind of error
 * remains or the smaller plan still fails.
 */
export function salvagePlan(plan: Plan, errors: string[], parsed: ParsedApp): { plan: Plan; dropped: string[] } | null {
  const obligations = new Set<string>()
  const movedToItself = new Set<string>()
  const movedToShared = new Set<string>()
  for (const error of errors) {
    const obligation = /^obligation "([^"]+)" of unit "([^"]+)"/.exec(error)
    const itself = /^unit "([^"]+)" has a movedTo difference that points at itself/.exec(error)
    const toShared = /^unit "([^"]+)" moves "(.*)" to shared unit "[^"]+"/.exec(error)
    if (obligation) obligations.add(`${obligation[2]}/${obligation[1]}`)
    else if (itself) movedToItself.add(itself[1]!)
    else if (toShared) movedToShared.add(`${toShared[1]}/${toShared[2]}`)
    else return null
  }
  const dropped: string[] = []
  const units = plan.units.map((unit) => ({
    ...unit,
    obligations: unit.obligations.filter((o) => {
      if (!obligations.has(`${unit.id}/${o.id}`)) return true
      dropped.push(`obligation ${unit.id}/${o.id}`)
      return false
    }),
    intentionalDifferences: unit.intentionalDifferences.filter((d) => {
      if (d.kind !== "movedTo") return true
      if (!(movedToItself.has(unit.id) && d.toUnit === unit.id) && !movedToShared.has(`${unit.id}/${d.what}`)) return true
      dropped.push(`movedTo ${unit.id}: ${d.what}`)
      return false
    }),
  }))
  const salvaged: Plan = { ...plan, units }
  return dropped.length > 0 && validatePlan(salvaged, parsed).length === 0 ? { plan: salvaged, dropped } : null
}
