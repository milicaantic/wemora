import type { LogEntry } from "../core/log"

// Short progress lines for the terminal during `wemora migrate`, made from the run log (run.jsonl).
// Only the events a person follows: phases, team changes, and the verdict for each unit.

export type ProgressContext = {
  /** Status of a unit after promotion (from the board), e.g. "proven". */
  statusOf(unitId: string): string | undefined
  /** Units, screens and flows of the plan once it is ready. */
  planSummary(): { units: number; screens: number; flows: number } | null
}

type Data = Record<string, unknown>

export function progressLine(entry: LogEntry, startedAt: number, context: ProgressContext): string | null {
  const text = describe(entry, (entry.data ?? {}) as Data, context)
  if (text === null) return null
  return `[${elapsed(Date.parse(entry.t) - startedAt)}] ${text}`
}

function describe(entry: LogEntry, d: Data, context: ProgressContext): string | null {
  switch (entry.event) {
    case "run.started":
      return "analyzing the web app"
    case "plan.ready": {
      const plan = context.planSummary()
      return plan ? `plan ready: ${plan.units} units, ${plan.screens} screens, ${plan.flows} flows` : "plan ready"
    }
    case "plan.rejected":
      return `plan rejected (attempt ${d.attempt}), the architect tries again`
    case "agents.rescaled":
      if (d.builders === 0 && d.testers === 0) return null
      return `team: ${d.builders} builder(s), ${d.testers} tester(s)`
    case "tester.saved":
      return `tester saved a test for ${d.unitId ?? d.flowId}: ${d.scenarioId}`
    case "tests.ready":
      return `tests ready for ${d.unitId}`
    case "gatekeeper.waiting_for_tests":
      return `${d.unitId} round ${d.round} is built, waiting for its tests`
    case "gatekeeper.check_started":
      return `checking ${d.unitId} round ${d.round} on the mobile app`
    case "gate.failed":
      return `✗ ${d.unitId} round ${d.round} failed the gates, back to its builder`
    case "unit.promoted": {
      const status = context.statusOf(String(d.unitId))
      return `✓ ${d.unitId} promoted${status ? ` (${status})` : ""}`
    }
    case "unit.failed":
      return `✗ ${d.unitId} failed: ${d.reason}`
    case "gatekeeper.flow_checked":
      return `${d.ok ? "✓" : "✗"} flow ${d.flowId} ${d.ok ? "passes" : "fails"}`
    case "rate.limited":
      return `API rate limit: at most ${d.maxBuilders} builder(s) for now`
    case "budget.exceeded":
      return "budget reached: no new work, finishing"
    case "run.finished":
      return "finishing: writing the report"
    default:
      return null
  }
}

function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}
