import { describe, expect, it } from "vitest"
import type { LogEntry } from "../core/log"
import { progressLine } from "./progress"

const start = Date.parse("2026-10-31T18:00:00.000Z")
const at = (seconds: number) => new Date(start + seconds * 1000).toISOString()
const entry = (seconds: number, event: string, data?: unknown): LogEntry => ({ t: at(seconds), agent: "conductor", event, data })
const context = {
  statusOf: (unitId: string) => (unitId === "recipe-detail" ? "proven" : undefined),
  planSummary: () => ({ units: 8, screens: 5, flows: 3 }),
}

describe("progressLine", () => {
  it("prints the phases, team changes and verdicts with the time since the start", () => {
    expect(progressLine(entry(0, "run.started"), start, context)).toBe("[00:00] analyzing the web app")
    expect(progressLine(entry(65, "plan.ready"), start, context)).toBe("[01:05] plan ready: 8 units, 5 screens, 3 flows")
    expect(progressLine(entry(141, "agents.rescaled", { builders: 4, testers: 2 }), start, context)).toBe("[02:21] team: 4 builder(s), 2 tester(s)")
    expect(progressLine(entry(185, "unit.promoted", { unitId: "recipe-detail" }), start, context)).toBe("[03:05] ✓ recipe-detail promoted (proven)")
    expect(progressLine(entry(271, "gate.failed", { unitId: "favorites", round: 3 }), start, context)).toBe(
      "[04:31] ✗ favorites round 3 failed the gates, back to its builder",
    )
    expect(progressLine(entry(300, "rate.limited", { maxBuilders: 2 }), start, context)).toBe("[05:00] API rate limit: at most 2 builder(s) for now")
    expect(progressLine(entry(27, "tester.saved", { unitId: "todo-list", scenarioId: "todo-list-add-todo" }), start, context)).toBe(
      "[00:27] tester saved a test for todo-list: todo-list-add-todo",
    )
    expect(progressLine(entry(15, "gatekeeper.waiting_for_tests", { unitId: "todo-list", round: 1 }), start, context)).toBe(
      "[00:15] todo-list round 1 is built, waiting for its tests",
    )
    expect(progressLine(entry(90, "tests.ended_empty", { flowId: "categories-to-detail", gaveUp: false }), start, context)).toBe(
      "[01:30] tester found no test for flow categories-to-detail, it goes back to the queue",
    )
    expect(progressLine(entry(95, "tests.ended_empty", { unitId: "favorites", gaveUp: true }), start, context)).toBe(
      "[01:35] tester found no test for favorites, left without tests",
    )
  })

  it("stays quiet for model calls, tool calls and the analyzers-only team line", () => {
    for (const event of ["inference.started", "model.usage", "function_call.started", "task.assigned"]) {
      expect(progressLine(entry(1, event), start, context)).toBeNull()
    }
    expect(progressLine(entry(1, "agents.rescaled", { analyzers: 1, builders: 0, testers: 0 }), start, context)).toBeNull()
  })
})
