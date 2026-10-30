import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type { InteractiveElement, Scenario, Unit } from "../contracts"
import { coverageNote, readTests, scenarioProblem, testerBrief, testsFile, writeTests } from "./tester"

const unit: Unit = {
  id: "orders",
  kind: "screen",
  wave: 1,
  route: "/narudzbine",
  sources: ["src/pages/Orders.tsx"],
  writes: ["src/screens/orders/"],
  dependsOn: [],
  obligations: [
    { id: "search", description: "Typing 'Petar' in 'Pretraga' hides #1043" },
    { id: "save", description: "'Sačuvaj' shows 'Sačuvano'" },
  ],
  intentionalDifferences: [{ kind: "notPortable", element: { role: "button", name: "Info" }, reason: "hover only" }],
  size: 1000,
}

const interactive: InteractiveElement[] = [
  { role: "searchbox", name: "Pretraga" },
  { role: "button", name: "Sačuvaj" },
  { role: "button", name: "Info" },
]

const search: Scenario = {
  id: "orders-search",
  unitId: "orders",
  obligation: "search",
  steps: [{ goto: "/narudzbine" }, { fill: { label: "Pretraga", value: "Petar" } }, { expectNotVisible: { text: "#1043" } }],
}
const save: Scenario = {
  id: "orders-save",
  unitId: "orders",
  obligation: "save",
  steps: [{ goto: "/narudzbine" }, { tap: { role: "button", name: "Sačuvaj" } }, { expectVisible: { text: "Sačuvano" } }],
}

describe("scenarioProblem", () => {
  it("accepts a scenario of this unit with a known obligation", () => {
    expect(scenarioProblem(search, unit, [])).toBeNull()
  })

  it("names the right unit, the known obligations and a duplicate id", () => {
    expect(scenarioProblem({ ...search, unitId: "other" }, unit, [])).toBe('unitId must be "orders", not "other".')
    expect(scenarioProblem({ ...search, obligation: "nope" }, unit, [])).toBe('Unknown obligation "nope". Use one of: search, save.')
    expect(scenarioProblem(search, unit, [search])).toContain('"orders-search" is already saved')
  })

  it("refuses a notPortable element in steps and in setup, by role and name or by text", () => {
    const byRole: Scenario = { ...save, steps: [{ goto: "/" }, { tap: { role: "button", name: "Info" } }] }
    const inSetup: Scenario = { ...search, setup: [{ goto: "/" }, { tap: { text: "Info" } }] }
    expect(scenarioProblem(byRole, unit, [])).toContain('button "Info", which does not exist on mobile (hover only)')
    expect(scenarioProblem(inSetup, unit, [])).toContain("does not exist on mobile")
  })
})

describe("testerBrief", () => {
  it("lists obligations, elements to use, elements to avoid and saved scenarios", () => {
    const brief = testerBrief(unit, interactive, [search])
    expect(brief).toContain("Unit: orders")
    expect(brief).toContain("- search: Typing 'Petar' in 'Pretraga' hides #1043")
    expect(brief).toContain('- button "Sačuvaj"')
    expect(brief).toContain('- button "Info" (hover only)')
    expect(brief).toContain("orders-search [search]")
  })

  it("explains route parameters", () => {
    expect(testerBrief({ ...unit, route: "/recepti/:id" }, [], [])).toContain("open it with real values")
  })
})

describe("coverageNote", () => {
  it("says what is still missing, then that the tester may finish", () => {
    expect(coverageNote(unit, [search], interactive)).toBe(
      'Obligations still without a scenario: save. Elements not used in any scenario yet: button "Sačuvaj".',
    )
    expect(coverageNote(unit, [search, save], interactive)).toMatch(/^All obligations and interactive elements are covered/)
  })
})

describe("tests file", () => {
  it("writes tests/<unitId>.json and reads it back; a missing file is an empty list", () => {
    const runDir = mkdtempSync(path.join(tmpdir(), "wemora-tests-"))
    expect(readTests(runDir, "orders")).toEqual([])
    writeTests(runDir, "orders", [search, save])
    expect(readTests(runDir, "orders")).toEqual([search, save])
    expect(existsSync(`${testsFile(runDir, "orders")}.tmp`)).toBe(false)
    expect(JSON.parse(readFileSync(testsFile(runDir, "orders"), "utf8"))).toHaveLength(2)
  })

  it("refuses to write an invalid scenario", () => {
    const runDir = mkdtempSync(path.join(tmpdir(), "wemora-tests-"))
    expect(() => writeTests(runDir, "orders", [{ ...search, steps: [] }])).toThrow()
  })
})
