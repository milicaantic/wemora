import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { createHuman, SituationSpecification, type Participant, type SituationContext } from "@mozaik-ai/core"
import { beforeAll, describe, expect, it } from "vitest"
import { PlanSchema, UnitResultSchema, type CheckDraft, type CheckDraftInput, type GateResult, type RunConfig, type Scenario } from "../contracts"
import { initLog } from "../core/log"
import { MockRunner } from "../core/runner"
import { board, emit, initializeRuntime, join } from "../core/runtime"
import { createInitialState } from "../core/state"
import { createGatekeeper } from "./gatekeeperParticipant"

// Svi testovi koji traže runtime su u ovom fajlu: Mozaik dozvoljava jedan runtime po procesu.

const plan = PlanSchema.parse(JSON.parse(readFileSync("examples/recepti/wemora/plan.manual.json", "utf8")))
const test = (unitId: string): Scenario => ({ id: `${unitId}-t1`, unitId, obligation: "o", steps: [{ goto: "/" }] })

// Lažni checkDraft: beleži preklapanja, pada za jedinice iz `failFor`, baca za `throwFor`.
const calls: { unitId: string; round: number; draftDir: string; tests: number }[] = []
let active = 0
let maxActive = 0
const failFor = new Set<string>()
const throwFor = new Set<string>()
const fakeCheck: CheckDraft = async ({ unit, round, draftDir, tests }: CheckDraftInput) => {
  active++
  maxActive = Math.max(maxActive, active)
  calls.push({ unitId: unit.id, round, draftDir, tests: tests.length })
  await new Promise((r) => setTimeout(r, 30))
  active--
  if (throwFor.has(unit.id)) throw new Error("export pukao")
  const g = (gate: GateResult["gate"], ok: boolean, message: string): GateResult => ({ unitId: unit.id, round, gate, ok, message })
  return failFor.has(unit.id)
    ? [g("parse", true, "ok"), g("labels", false, 'nema elementa sa accessibilityLabel "Pretraga"')]
    : [g("parse", true, "ok"), g("scenarios", true, "ok")]
}

class AnyOf extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "gate.failed" || event.type === "unit.promoted"
  }
}

const outcomes: { type: string; unitId: string; round?: number }[] = []
let runDir = ""
let builder: Participant

function waitFor(type: string, unitId: string, ms = 5_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (outcomes.some((o) => o.type === type && o.unitId === unitId)) return resolve()
      if (Date.now() - started > ms) return reject(new Error(`nema ${type} za ${unitId}`))
      setTimeout(tick, 10)
    }
    tick()
  })
}

const submit = (unitId: string, round = 1) => {
  board().units[unitId] = { status: "building", round, model: null, builderId: "builder-7", testerId: null, testAttempts: 0 }
  emit("draft.submitted", { unitId, round }, builder.getId())
}

beforeAll(() => {
  runDir = mkdtempSync(path.join(tmpdir(), "wemora-gk-"))
  initLog(runDir)
  const config: RunConfig = { webDir: "examples/recepti", runDir, maxBuilders: 2, maxTesters: 1, budgetUsd: 0, mock: true }
  const state = createInitialState("gatekeeper-test", config)
  state.plan = plan
  initializeRuntime({ state, inferenceRunnerConfig: { runner: new MockRunner({}) } })

  join(createGatekeeper("gatekeeper-1", { checkDraft: fakeCheck }))
  builder = createHuman({ name: "builder-7", capabilities: [], handlers: [] })
  join(builder)
  join(
    createHuman({
      name: "listener",
      capabilities: [],
      handlers: [
        {
          specification: new AnyOf(),
          processor: { apply: ({ event }) => void outcomes.push({ type: event.type, ...(event.payload as { unitId: string; round?: number }) }) },
        },
      ],
    }),
  )
})

describe("Gatekeeper-učesnik", () => {
  it("dva nacrta u isto vreme se proveravaju jedan za drugim", async () => {
    board().tests["recipe-list"] = [test("recipe-list")]
    board().tests["categories"] = [test("categories")]
    emit("tests.ready", { unitId: "recipe-list" }, builder.getId())
    emit("tests.ready", { unitId: "categories" }, builder.getId())
    maxActive = 0
    submit("recipe-list")
    submit("categories")
    await waitFor("unit.promoted", "recipe-list")
    await waitFor("unit.promoted", "categories")
    expect(maxActive).toBe(1)
    expect(calls.filter((c) => ["recipe-list", "categories"].includes(c.unitId)).map((c) => c.unitId)).toEqual(["recipe-list", "categories"])
    expect(calls[0]!.draftDir).toBe(path.join(runDir, "staging", "builder-7", "recipe-list"))
  })

  it("nacrt bez testova ne biva promovisan: čeka (bez sopstvenog tajmera)", async () => {
    submit("favorites")
    await new Promise((r) => setTimeout(r, 200))
    expect(calls.some((c) => c.unitId === "favorites")).toBe(false)
    expect(outcomes.some((o) => o.unitId === "favorites")).toBe(false)
  })

  it("tests.missing: ekran koji čeka ide na proveru bez testova i ulazi kao unproven (D-016)", async () => {
    // "favorites" čeka iz prethodnog testa
    emit("tests.missing", { unitId: "favorites" }, builder.getId())
    await waitFor("unit.promoted", "favorites")
    expect(calls.find((c) => c.unitId === "favorites")?.tests).toBe(0)
    const result = UnitResultSchema.parse(JSON.parse(readFileSync(path.join(runDir, "results", "favorites.json"), "utf8")))
    expect(result.status).toBe("unproven")
  })

  it("tests.missing pre nacrta: nacrt ide odmah, bez čekanja", async () => {
    // recipe-detail nema testova
    emit("tests.missing", { unitId: "recipe-detail" }, builder.getId())
    submit("recipe-detail", 3)
    await waitFor("unit.promoted", "recipe-detail")
    expect(calls.find((c) => c.unitId === "recipe-detail")?.round).toBe(3)
  })

  it("zakasneli nacrt iz ranije runde se ignoriše (D-016)", async () => {
    board().tests["shopping-list"] = [test("shopping-list")]
    board().units["shopping-list"] = { status: "building", round: 2, model: null, builderId: "builder-7", testerId: null, testAttempts: 0 }
    const before = calls.length
    emit("draft.submitted", { unitId: "shopping-list", round: 1 }, builder.getId())
    await new Promise((r) => setTimeout(r, 100))
    expect(calls.length).toBe(before)
    expect(outcomes.some((o) => o.unitId === "shopping-list" && o.type === "gate.failed")).toBe(false)
  })

  it("testovi na tabli nisu dovoljni: čeka se događaj tests.ready (tester ih upisuje jedan po jedan)", async () => {
    // tester je sačuvao 1 od 3 testa i još radi
    board().tests["shopping-list"] = [test("shopping-list")]
    board().units["shopping-list"] = { status: "building", round: 1, model: null, builderId: "builder-7", testerId: null, testAttempts: 0 }
    emit("draft.submitted", { unitId: "shopping-list", round: 1 }, builder.getId())
    await new Promise((r) => setTimeout(r, 150))
    expect(calls.some((c) => c.unitId === "shopping-list" && c.round === 1)).toBe(false)

    // tester završi: svi testovi na tabli, pa tests.ready
    board().tests["shopping-list"] = [test("shopping-list"), { ...test("shopping-list"), id: "shopping-list-t2" }, { ...test("shopping-list"), id: "shopping-list-t3" }]
    emit("tests.ready", { unitId: "shopping-list" }, builder.getId())
    await waitFor("unit.promoted", "shopping-list")
    expect(calls.find((c) => c.unitId === "shopping-list" && c.round === 1)?.tests).toBe(3)
  })

  it("zajednička jedinica ne čeka testove", async () => {
    submit("data")
    await waitFor("unit.promoted", "data")
    expect(board().results["data"]!.status).toBe("unproven")
  })

  it("pad kapije: rezultat na tabli i na disku, pa gate.failed sa rundom", async () => {
    failFor.add("shopping-list")
    board().tests["shopping-list"] = [test("shopping-list")]
    submit("shopping-list", 2)
    await waitFor("gate.failed", "shopping-list")
    expect(outcomes.find((o) => o.type === "gate.failed" && o.unitId === "shopping-list")?.round).toBe(2)
    const result = UnitResultSchema.parse(JSON.parse(readFileSync(path.join(runDir, "results", "shopping-list.json"), "utf8")))
    expect(result).toMatchObject({ status: "failed", rounds: 2 })
    expect(result.reason).toBe('labels: nema elementa sa accessibilityLabel "Pretraga"')
    // Conductor iz table čita poruku za sledeću rundu
    expect(board().results["shopping-list"]!.gates.find((g) => !g.ok)?.message).toContain("Pretraga")
  })

  it("promovisan ekran sa testovima: status iz computeStatus (bez pokrivenosti → partial)", async () => {
    expect(board().results["recipe-list"]!.status).toBe("partial")
  })

  it("greška u proveri ne ruši učesnika: gate.failed i red ide dalje", async () => {
    throwFor.add("layout")
    submit("layout")
    await waitFor("gate.failed", "layout")
    expect(board().results["layout"]!.gates[0]!.message).toContain("export pukao")
    throwFor.delete("layout")
    submit("layout", 2)
    await new Promise((r) => setTimeout(r, 100))
    expect(outcomes.filter((o) => o.unitId === "layout").map((o) => o.type)).toEqual(["gate.failed", "unit.promoted"])
  })
})
