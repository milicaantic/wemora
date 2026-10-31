import { describe, expect, it } from "vitest"
import type { Flow, RunScenarios, Scenario, ServeApp } from "../contracts"
import { createCheckFlow, PHONE } from "./index"

const flow: Flow = { id: "favorite-flow", description: "Dodaj u omiljene, pa Omiljeni.", unitIds: ["recipe-detail", "favorites"] }
const test = (id: string): Scenario => ({ id, unitId: "recipe-detail", obligation: "favorite-flow", flowId: "favorite-flow", steps: [{ goto: "/" }] })
const differences = [{ kind: "notPortable" as const, element: { role: "button", name: "Štampaj" }, reason: "nema štampača" }]

let served = 0
let closed = 0
const serve: ServeApp = async () => {
  served++
  return { url: "http://fake", close: async () => void closed++ }
}
const runner = (okIds: string[], seen: unknown[] = []): RunScenarios => async (_url, scenarios, opts) => {
  seen.push(opts)
  return scenarios.filter((s) => s.id !== "bez-rezultata").map((s) => ({ scenarioId: s.id, unitId: s.unitId, ok: okIds.includes(s.id), durationMs: 1 }))
}

describe("checkFlow", () => {
  it("svi testovi toka prolaze → ok; telefon i namerne razlike idu izvršiocu; server se gasi", async () => {
    const seen: unknown[] = []
    const result = await createCheckFlow({ serveApp: serve, runScenarios: runner(["t1", "t2"], seen) })({ flow, tests: [test("t1"), test("t2")], appDir: "/app", differences })
    expect(result).toMatchObject({ flowId: "favorite-flow", ok: true })
    expect(result.scenarios).toHaveLength(2)
    expect(seen).toEqual([{ viewport: PHONE, differences }])
    expect(served).toBe(closed)
  })

  it("jedan test pada → tok nije ok", async () => {
    const result = await createCheckFlow({ serveApp: serve, runScenarios: runner(["t1"]) })({ flow, tests: [test("t1"), test("t2")], appDir: "/app", differences: [] })
    expect(result.ok).toBe(false)
    expect(result.scenarios.find((s) => s.scenarioId === "t2")?.ok).toBe(false)
  })

  it("test bez rezultata se računa kao pao", async () => {
    const result = await createCheckFlow({ serveApp: serve, runScenarios: runner(["t1"]) })({ flow, tests: [test("t1"), test("bez-rezultata")], appDir: "/app", differences: [] })
    expect(result.ok).toBe(false)
    expect(result.scenarios.find((s) => s.scenarioId === "bez-rezultata")?.error).toBe("nema rezultata")
  })

  it("tok bez testova nije ok i ne pokreće aplikaciju", async () => {
    const before = served
    const result = await createCheckFlow({ serveApp: serve, runScenarios: runner([]) })({ flow, tests: [], appDir: "/app", differences: [] })
    expect(result).toEqual({ flowId: "favorite-flow", ok: false, scenarios: [] })
    expect(served).toBe(before)
  })

  it("aplikacija ne može da se pokrene → svi testovi toka padaju sa jasnom porukom", async () => {
    const broken: ServeApp = async () => {
      throw new Error("Web export aplikacije nije uspeo")
    }
    const result = await createCheckFlow({ serveApp: broken, runScenarios: runner(["t1"]) })({ flow, tests: [test("t1")], appDir: "/app", differences: [] })
    expect(result.ok).toBe(false)
    expect(result.scenarios[0]!.error).toContain("aplikacija nije mogla da se pokrene")
  })
})
