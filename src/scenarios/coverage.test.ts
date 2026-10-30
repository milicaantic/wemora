import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { PlanSchema, ScenarioSchema, type InteractiveElement, type Scenario, type Unit } from "../contracts"
import { computeCoverage } from "./coverage"

const unit: Unit = {
  id: "orders",
  kind: "screen",
  wave: 1,
  route: "/narudzbine",
  sources: ["src/pages/Orders.tsx"],
  writes: ["src/screens/orders/"],
  dependsOn: [],
  obligations: [
    { id: "search", description: "Search by customer" },
    { id: "detail", description: "Open the detail" },
    { id: "shopping", description: "Mark an item as bought" },
  ],
  intentionalDifferences: [{ kind: "notPortable", element: { role: "button", name: "Info" }, reason: "hover only" }],
  size: 1000,
}

const interactive: InteractiveElement[] = [
  { role: "searchbox", name: "Pretraga" },
  { role: "button", name: "Sačuvaj" },
  { role: "button", name: "Info" },
  { role: "link", name: "Detalj" },
  { role: "checkbox", name: "Hleb" },
]

const scenario = (id: string, obligation: string, steps: Scenario["steps"], extra: Partial<Scenario> = {}): Scenario => ({
  id,
  unitId: "orders",
  obligation,
  steps,
  ...extra,
})

describe("computeCoverage", () => {
  it("splits obligations and elements into covered, missing and notPortable", () => {
    const scenarios = [
      scenario("s1", "search", [{ goto: "/" }, { fill: { label: "Pretraga", value: "x" } }, { tap: { text: "Sačuvaj" } }]),
      // Setup steps count as use too.
      scenario("s2", "detail", [{ goto: "/" }], { setup: [{ goto: "/" }, { tap: { role: "link", name: "Detalj" } }] }),
      // Another unit's scenario covers nothing here.
      { ...scenario("s3", "shopping", [{ goto: "/" }, { tap: { role: "checkbox", name: "Hleb" } }]), unitId: "other" },
      // An unknown obligation counts for nothing; a different role does not cover the checkbox.
      scenario("s4", "unknown", [{ goto: "/" }, { tap: { role: "button", name: "Hleb" } }]),
    ]
    expect(computeCoverage(unit, scenarios, interactive)).toEqual({
      unitId: "orders",
      obligations: { covered: ["search", "detail"], missing: ["shopping"] },
      elements: {
        covered: [
          { role: "searchbox", name: "Pretraga" },
          { role: "button", name: "Sačuvaj" },
          { role: "link", name: "Detalj" },
        ],
        missing: [{ role: "checkbox", name: "Hleb" }],
        notPortable: [{ role: "button", name: "Info" }],
      },
    })
  })

  it("never counts a notPortable element as missing, even when no scenario exists", () => {
    const coverage = computeCoverage(unit, [], interactive)
    expect(coverage.obligations).toEqual({ covered: [], missing: ["search", "detail", "shopping"] })
    expect(coverage.elements.notPortable).toEqual([{ role: "button", name: "Info" }])
    expect(coverage.elements.missing).toHaveLength(4)
  })

  it("works on the Recepti plan with the elements extracted from the running app", () => {
    const plan = PlanSchema.parse(
      JSON.parse(readFileSync(new URL("../../examples/recepti/wemora/plan.manual.json", import.meta.url), "utf8")),
    )
    const recipeList = plan.units.find((u) => u.id === "recipe-list")!
    const search = ScenarioSchema.parse(
      JSON.parse(readFileSync(new URL("./mocks/recepti/search-by-name.json", import.meta.url), "utf8")),
    )
    // extractInteractive("http://localhost:5173", "/") on Recepti, fixture "default".
    const extracted: InteractiveElement[] = [
      { role: "searchbox", name: "Pretraga" },
      { role: "button", name: "Sve kategorije" },
      { role: "button", name: "Supe" },
      { role: "button", name: "Glavna jela" },
      { role: "button", name: "Salate" },
      { role: "button", name: "Deserti" },
      { role: "button", name: "Sortiraj po vremenu" },
      { role: "link", name: "Pileća supa" },
      { role: "button", name: "Dodaj u omiljene: Pileća supa" },
    ]

    const coverage = computeCoverage(recipeList, [search], extracted)
    expect(coverage.obligations.covered).toEqual(["search-by-name"])
    expect(coverage.obligations.missing).toHaveLength(5)
    expect(coverage.elements.covered).toEqual([{ role: "searchbox", name: "Pretraga" }])
    const { covered, missing, notPortable } = coverage.elements
    expect(covered.length + missing.length + notPortable.length).toBe(extracted.length)
  })
})
