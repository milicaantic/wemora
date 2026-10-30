import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { Plan, RunConfig, Unit } from "../contracts"
import { MODELS } from "../core/config"
import { initLog } from "../core/log"
import { board, initializeRuntime, resolveRuntime } from "../core/runtime"
import { createInitialState } from "../core/state"
import { Conductor, type ConductorOptions } from "./conductor"
import { fakeWorld, type FakeScript } from "./mocks/fakeAgents"

const unit = (id: string, kind: Unit["kind"], wave: number, dependsOn: string[], size = 1000): Unit => ({
  id,
  kind,
  wave,
  route: kind === "screen" ? `/${id}` : undefined,
  sources: [],
  writes: [],
  dependsOn,
  obligations: [],
  intentionalDifferences: [],
  size,
})

// 2 shared units in wave 0, 2 screens in wave 1, 1 screen in wave 2.
const plan: Plan = {
  units: [
    unit("api", "shared", 0, [], 2000),
    unit("store", "shared", 0, [], 1000),
    unit("list", "screen", 1, ["api"]),
    unit("detail", "screen", 1, ["api", "store"]),
    unit("edit", "screen", 2, ["detail"]),
  ],
  flows: [{ id: "open", description: "list → detail", unitIds: ["list", "detail"] }],
  routeMap: {},
}

const root = mkdtempSync(path.join(tmpdir(), "conductor-"))
const config: RunConfig = { webDir: "examples/fake", runDir: path.join(root, "run"), maxBuilders: 2, maxTesters: 1, budgetUsd: 1, mock: true }
let logDir = ""

beforeAll(() => {
  initializeRuntime({ state: createInitialState("conductor-test", config) })
})

// One runtime per process, so each test starts from an empty board and its own run.jsonl.
beforeEach(() => {
  Object.assign(board(), { parsed: null, reports: {}, plan: null, units: {}, tests: {}, results: {}, coverage: {}, statuses: {}, agents: {} })
  logDir = mkdtempSync(path.join(root, "log-"))
  initLog(logDir)
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

async function runWith(script: Partial<FakeScript> = {}, options: ConductorOptions = {}) {
  const { deps, calls } = fakeWorld({ plan, ...script })
  const participantsBefore = resolveRuntime().state.getParticipants().length
  const summary = await new Conductor(deps, options).run()
  const logLines = readFileSync(path.join(logDir, "run.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { agent: string; event: string; data?: Record<string, unknown> })
  return { summary, calls, logLines, participantsAfter: resolveRuntime().state.getParticipants().length, participantsBefore }
}

describe("Conductor", () => {
  it("runs the whole flow and promotes every unit", async () => {
    const { summary, calls } = await runWith({ parts: 2 })

    expect(summary.outcome).toBe("finished")
    expect(summary.units).toEqual({ api: "promoted", store: "promoted", list: "promoted", detail: "promoted", edit: "promoted" })
    expect(summary.reportPath).toBe(path.join(config.runDir, "report.html"))
    expect(calls.buildReport).toBe(1)
  })

  it("starts the architect once, only after the last analysis.done", async () => {
    const { calls } = await runWith({ parts: 2 })

    expect(calls.analyzer.map((t) => t.partId)).toEqual(["p1", "p2"])
    expect(calls.architect).toEqual([{ partIds: ["p1", "p2"] }])
    expect(calls.order.indexOf("architect")).toBeGreaterThan(calls.order.indexOf("analysis.done:p2"))
  })

  it("scaffolds once, then sends testers to screens of every wave and builders to ready units only", async () => {
    const { calls } = await runWith()

    expect(calls.scaffold).toBe(1)
    const firstWork = calls.order.findIndex((step) => step.startsWith("tester:") || step.startsWith("builder:"))
    expect(calls.order.indexOf("scaffold")).toBeLessThan(firstWork)
    expect(calls.tester.map((t) => t.unitId).sort()).toEqual(["detail", "edit", "list"])
    expect(calls.builder.slice(0, 2).map((t) => t.unitId)).toEqual(["api", "store"])
    expect(calls.builder.map((t) => t.unitId).indexOf("edit")).toBeGreaterThan(calls.builder.map((t) => t.unitId).indexOf("detail"))
  })

  it("gives a failed unit back to the same builder with the gate error, then promotes it", async () => {
    const { summary, calls } = await runWith({ failRounds: { list: 1 } })

    const rounds = calls.builder.filter((t) => t.unitId === "list")
    expect(rounds.map((t) => t.round)).toEqual([1, 2])
    expect(rounds[1].builderId).toBe(rounds[0].builderId)
    expect(rounds[1].lastError).toBe('missing label "Pretraga" in round 1')
    expect(rounds.map((t) => t.model)).toEqual([MODELS.default, MODELS.default])
    expect(summary.units.list).toBe("promoted")
  })

  it("fails a unit after the last round and blocks everything that depends on it", async () => {
    const { summary, calls, logLines } = await runWith({ failRounds: { detail: Infinity } })

    expect(calls.builder.filter((t) => t.unitId === "detail").map((t) => t.round)).toEqual([1, 2])
    expect(calls.builder.some((t) => t.unitId === "edit")).toBe(false)
    expect(summary.units).toMatchObject({ detail: "failed", edit: "failed", list: "promoted" })
    expect(summary.outcome).toBe("finished")
    expect(logLines.some((l) => l.event === "unit.blocked" && l.data?.unitId === "edit")).toBe(true)
  })

  it("ends the run with a report when the architect gives up", async () => {
    const { summary, calls } = await runWith({ planFails: true })

    expect(summary.outcome).toBe("plan.failed")
    expect(calls.scaffold).toBe(0)
    expect(calls.builder).toEqual([])
    expect(calls.buildReport).toBe(1)
  })

  it("stops handing out work after budget.exceeded and fails what never started", async () => {
    const { summary, calls } = await runWith({ budgetAfterPromotions: 1 })

    // "list" was handed out when "api" was promoted, just before budget.exceeded arrived, so it still finishes.
    expect(summary.outcome).toBe("budget.exceeded")
    expect(calls.builder.map((t) => t.unitId)).toEqual(["api", "store", "list"])
    expect(summary.units).toMatchObject({ api: "promoted", store: "promoted", list: "promoted", detail: "failed", edit: "failed" })
  })

  it("stops handing out work when the runner reports the budget through notifyBudgetExceeded", async () => {
    const { deps, calls } = fakeWorld({ plan })
    const conductor = new Conductor(deps)
    const running = conductor.run()
    conductor.notifyBudgetExceeded()

    const summary = await running
    expect(summary.outcome).toBe("budget.exceeded")
    expect(calls.builder).toEqual([])
    expect(Object.values(summary.units).every((status) => status === "failed")).toBe(true)
  })

  it("ends with an error, and still builds the report, when parsing fails", async () => {
    const { summary, calls } = await runWith({ parseError: "Next.js is not supported" })

    expect(summary).toMatchObject({ outcome: "error", error: "Next.js is not supported" })
    expect(calls.buildReport).toBe(1)
  })

  it("logs every event by agent name, skips inference.stream, and leaves the runtime as it found it", async () => {
    const { logLines, participantsAfter, participantsBefore } = await runWith({ emitStream: true })

    const events = new Set(logLines.map((l) => l.event))
    for (const name of ["analysis.done", "plan.ready", "tests.ready", "draft.submitted", "unit.promoted", "participant.joined"]) {
      expect(events).toContain(name)
    }
    expect(events).not.toContain("inference.stream")
    expect(logLines.find((l) => l.event === "analysis.done")?.agent).toBe("analyzer-1")
    expect(participantsAfter).toBe(participantsBefore)
  })

  it("records agents and assignments on the board", async () => {
    await runWith()

    expect(Object.keys(board().agents).sort()).toEqual(["analyzer-1", "architect-1", "builder-1", "builder-2", "gatekeeper-1", "tester-1"])
    expect(Object.values(board().agents).every((a) => a.busyWith === null)).toBe(true)
    expect(board().units.api).toMatchObject({ status: "promoted", round: 1, builderId: expect.stringMatching(/^builder-/) })
    expect(board().units.list.testerId).toBe("tester-1")
  })
})
