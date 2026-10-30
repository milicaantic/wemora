import { describe, expect, it } from "vitest"
import type { Coverage, Scenario, ScenarioResult, StatusInput } from "../contracts"
import { computeStatus } from "./index"

const test = (id: string): Scenario => ({
  id,
  unitId: "shopping-list",
  obligation: id,
  steps: [{ goto: "/kupovina" }],
})
const result = (scenarioId: string, ok: boolean): ScenarioResult => ({
  scenarioId,
  unitId: "shopping-list",
  ok,
  durationMs: 100,
})
const el = (name: string) => ({ role: "button", name })

const FULL: Coverage = {
  unitId: "shopping-list",
  obligations: { covered: ["add-item", "empty-state"], missing: [] },
  elements: { covered: [el("Dodaj")], missing: [], notPortable: [] },
}

const input = (over: Partial<StatusInput>): StatusInput => ({
  tests: [test("add-item"), test("empty-state")],
  results: [result("add-item", true), result("empty-state", true)],
  coverage: FULL,
  ...over,
})

describe("computeStatus", () => {
  it("proven: svi testovi prolaze i sve je pokriveno", () => {
    expect(computeStatus(input({}))).toBe("proven")
  })

  it("partial: testovi prolaze, ali fali obaveza", () => {
    const coverage = { ...FULL, obligations: { covered: ["add-item"], missing: ["empty-state"] } }
    expect(computeStatus(input({ coverage }))).toBe("partial")
  })

  it("partial: testovi prolaze, ali fali interaktivni element", () => {
    const coverage = { ...FULL, elements: { covered: [el("Dodaj")], missing: [el("Obriši kupljene")], notPortable: [] } }
    expect(computeStatus(input({ coverage }))).toBe("partial")
  })

  it("partial: pokrivenost nije poznata", () => {
    expect(computeStatus(input({ coverage: null }))).toBe("partial")
  })

  it("unproven: nema testova", () => {
    expect(computeStatus(input({ tests: [], results: [] }))).toBe("unproven")
  })

  it("failed: bar jedan test ne prolazi", () => {
    expect(computeStatus(input({ results: [result("add-item", true), result("empty-state", false)] }))).toBe("failed")
  })

  it("failed: test bez rezultata se računa kao pao", () => {
    expect(computeStatus(input({ results: [result("add-item", true)] }))).toBe("failed")
  })


  it("važi poslednji rezultat istog testa", () => {
    const passedLater = [result("add-item", false), result("add-item", true), result("empty-state", true)]
    expect(computeStatus(input({ results: passedLater }))).toBe("proven")
    const failedLater = [result("add-item", true), result("add-item", false), result("empty-state", true)]
    expect(computeStatus(input({ results: failedLater }))).toBe("failed")
  })

  it("rezultati za testove koji nisu na spisku se ignorišu", () => {
    const results = [result("add-item", true), result("empty-state", true), result("stari-test", false)]
    expect(computeStatus(input({ results }))).toBe("proven")
  })

  it("notPortable element ne kvari proven", () => {
    const coverage = { ...FULL, elements: { covered: [el("Dodaj")], missing: [], notPortable: [el("Desni klik meni")] } }
    expect(computeStatus(input({ coverage }))).toBe("proven")
  })
})

describe("nula testova NIKAD nije proven", () => {
  it("ni sa savršenom pokrivenošću i uspešnim rezultatima", () => {
    for (const coverage of [FULL, null]) {
      const status = computeStatus({ tests: [], results: [result("add-item", true)], coverage })
      expect(status).toBe("unproven")
    }
  })
})
