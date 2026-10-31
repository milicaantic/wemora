import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { Plan, RunConfig, Unit } from "../contracts"
import { DEFAULTS, MODELS } from "../core/config"
import { initLog } from "../core/log"
import { board, initializeRuntime, resolveRuntime } from "../core/runtime"
import { createInitialState } from "../core/state"
import { Conductor, type ConductorOptions } from "./conductor"
import { fakeWorld, type FakeScript } from "./mocks/fakeAgents"
import { manualClock } from "./mocks/manualClock"

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

// A13: the clock only moves when a test calls advance(), so a 10-minute timeout takes no time.
describe("Conductor timeouts", () => {
  const TESTS_WAIT = DEFAULTS.testsWaitTimeoutMs
  const BUILD_ROUND = DEFAULTS.builderRoundTimeoutMs

  function startRun(script: Partial<FakeScript>, options: ConductorOptions = {}) {
    const clock = manualClock()
    const { deps, calls } = fakeWorld({ plan, ...script })
    const running = new Conductor(deps, { ...options, clock }).run()
    return { clock, calls, running }
  }
  const testedUnits = (calls: { tester: { unitId: string }[] }) => calls.tester.map((t) => t.unitId)
  const logEvents = () =>
    readFileSync(path.join(logDir, "run.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { event: string; data?: Record<string, unknown> })

  it("gives a screen to the tester again, after untried screens, when its tester times out", async () => {
    const { clock, calls, running } = startRun({ waitForTests: true, silentTests: { detail: 1 } })
    // detail goes first (most flows); its tester hangs while both screens wait in the Gatekeeper for tests.
    await vi.waitFor(() => expect(board().units.detail?.status).toBe("submitted"))
    expect(testedUnits(calls)).toEqual(["detail"])

    clock.advance(TESTS_WAIT)

    const summary = await running
    expect(testedUnits(calls)).toEqual(["detail", "list", "edit", "detail"])
    expect(calls.cancels).toEqual([expect.stringMatching(/^tester-1: timeout: no tests.ready within 10 min/)])
    expect(board().units.detail.testAttempts).toBe(1)
    expect(summary).toMatchObject({ outcome: "finished", units: { detail: "promoted", list: "promoted", edit: "promoted" } })
    expect(logEvents().filter((e) => e.event === "tests.timeout").map((e) => e.data?.unitId)).toEqual(["detail"])
  })

  it("sends tests.missing after the last attempt, and the Gatekeeper promotes the screen as unproven", async () => {
    const { clock, calls, running } = startRun({ waitForTests: true, silentTests: { detail: Infinity } })
    await vi.waitFor(() => expect(board().units.detail?.status).toBe("submitted"))
    clock.advance(TESTS_WAIT)
    await vi.waitFor(() => expect(testedUnits(calls)).toEqual(["detail", "list", "edit", "detail"]))
    clock.advance(TESTS_WAIT)

    const summary = await running
    expect(summary.outcome).toBe("finished")
    expect(summary.statuses.detail).toBe("unproven")
    expect(board().units.detail.testAttempts).toBe(DEFAULTS.maxTestAttempts)
    expect(logEvents().filter((e) => e.event === "tests.missing").map((e) => e.data?.unitId)).toEqual(["detail"])
  })

  it("counts a builder timeout as a failed round and gives the next round to the same builder", async () => {
    const { clock, calls, running } = startRun({ silentRounds: { list: 1 } })
    await vi.waitFor(() => expect(board().units.edit?.status).toBe("promoted"))
    expect(board().units.list.status).toBe("building")

    clock.advance(BUILD_ROUND)

    const summary = await running
    const rounds = calls.builder.filter((t) => t.unitId === "list")
    expect(rounds.map((t) => t.round)).toEqual([1, 2])
    expect(rounds[1].builderId).toBe(rounds[0].builderId)
    expect(rounds[1].lastError).toBe("no draft was submitted within 10 min in round 1; submit sooner")
    expect(calls.cancels).toEqual([expect.stringMatching(new RegExp(`^${rounds[0].builderId}: timeout: no draft within 10 min`))])
    expect(summary.units.list).toBe("promoted")
  })

  it("fails a unit whose builder never submits, after the last round", async () => {
    const { clock, calls, running } = startRun({ silentRounds: { list: Infinity } })
    await vi.waitFor(() => expect(board().units.edit?.status).toBe("promoted"))
    clock.advance(BUILD_ROUND)
    await vi.waitFor(() => expect(calls.builder.filter((t) => t.unitId === "list")).toHaveLength(2))
    clock.advance(BUILD_ROUND)

    const summary = await running
    expect(summary).toMatchObject({ outcome: "finished", units: { list: "failed", detail: "promoted" } })
  })

  it("waits for a cancelled agent to stop before it gets the next task", async () => {
    const { clock, calls, running } = startRun({ waitForTests: true, silentTests: { detail: 1 }, slowCancel: true })
    await vi.waitFor(() => expect(board().units.detail?.status).toBe("submitted"))

    clock.advance(TESTS_WAIT)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(testedUnits(calls)).toEqual(["detail"])

    clock.advance(DEFAULTS.idleCheckMs)
    await running
    expect(testedUnits(calls)).toEqual(["detail", "list", "edit", "detail"])
  })

  it("leaves no timer behind and cancels nothing when every agent answers in time", async () => {
    const { clock, calls, running } = startRun({ waitForTests: true })

    expect((await running).outcome).toBe("finished")
    expect(clock.pending()).toBe(0)
    expect(calls.cancels).toEqual([])
  })

  it("starts the team from the §9 formulas and logs the reason (A14)", async () => {
    const { running } = startRun({})
    await running

    const rescaled = logEvents().filter((e) => e.event === "agents.rescaled")
    expect(rescaled[0].data).toEqual({ analyzers: 1, builders: 0, testers: 0, reason: "10000 tokens → 1 analyzer(s)" })
    // api and store are ready after the plan; the test config allows 2 builders and 1 tester.
    expect(rescaled[1].data).toMatchObject({
      builders: 2,
      testers: 1,
      from: { builders: 0, testers: 0 },
      reason: "2 ready + 0 busy → 2 builder(s) (max 2), 1 tester(s) (max 1)",
    })
  })

  it("stops an idle builder one interval after the change was refused, and never a busy one", async () => {
    const { clock, calls, running } = startRun({ silentRounds: { list: Infinity } })
    // Everything but list is promoted, so one builder is enough, but the last change was less than a minute ago.
    await vi.waitFor(() => expect(board().units.edit?.status).toBe("promoted"))
    const busyBuilder = board().units.list.builderId
    expect(logEvents().some((e) => e.event === "agent.stopped")).toBe(false)

    clock.advance(DEFAULTS.rescaleIntervalMs)

    await vi.waitFor(() => expect(logEvents().filter((e) => e.event === "agent.stopped")).toHaveLength(1))
    const stopped = logEvents().find((e) => e.event === "agent.stopped")
    expect(stopped?.data).toMatchObject({ kind: "builder" })
    expect(stopped?.data?.id).not.toBe(busyBuilder)
    expect(logEvents().filter((e) => e.event === "agents.rescaled").at(-1)?.data).toMatchObject({ builders: 1, from: { builders: 2 } })

    clock.advance(BUILD_ROUND)
    await vi.waitFor(() => expect(calls.builder.filter((t) => t.unitId === "list")).toHaveLength(2))
    clock.advance(BUILD_ROUND)
    const summary = await running
    expect(calls.builder.filter((t) => t.unitId === "list").map((t) => t.builderId)).toEqual([busyBuilder, busyBuilder])
    expect(summary).toMatchObject({ outcome: "finished", units: { list: "failed" } })
  })

  it("ignores a late draft from a round that already timed out", async () => {
    // The cancelled builder still sends draft.submitted for round 1, after round 2 has started.
    const { clock, calls, running } = startRun({ silentRounds: { list: 1 }, lateDraftOnCancel: true })
    await vi.waitFor(() => expect(board().units.edit?.status).toBe("promoted"))
    clock.advance(BUILD_ROUND)
    await vi.waitFor(() => expect(calls.builder.filter((t) => t.unitId === "list")).toHaveLength(2))

    const summary = await running
    const stale = logEvents().filter((e) => e.event === "event.stale")
    expect(stale.map((e) => e.data)).toEqual([{ type: "draft.submitted", unitId: "list", round: 1, current: 2 }])
    expect(board().units.list).toMatchObject({ status: "promoted", round: 2 })
    expect(summary.outcome).toBe("finished")
  })
})
