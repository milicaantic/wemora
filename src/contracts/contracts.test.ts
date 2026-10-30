import { describe, expect, it } from "vitest"
import { EventPayloadSchemas, IntentionalDifferenceSchema, PlanSchema, ScenarioSchema, type Plan } from "./index"

// Example from docs/wemora-plan.md §4.1.
const exampleScenario = {
  id: "narudzbine-pretraga",
  unitId: "lista-narudzbina",
  obligation: "pretraga",
  steps: [
    { goto: "/narudzbine" },
    { fill: { label: "Pretraga", value: "Petar" } },
    { expectVisible: { text: "#1042" } },
    { expectNotVisible: { text: "#1043" } },
  ],
}

const screen = (id: string, route: string, dependsOn: string[]) => ({
  id,
  kind: "screen" as const,
  wave: 1,
  route,
  sources: [`src/pages/${id}.jsx`],
  writes: [`src/screens/${id}/`],
  dependsOn,
  obligations: [{ id: `${id}-shows-data`, description: "Shows the data from the API" }],
  intentionalDifferences: [],
  size: 3000,
})

// Hand-written plan for the Recepti example: 2 shared units, 5 screens.
const receptiPlan: Plan = {
  units: [
    { ...screen("api-client", "", []), kind: "shared", wave: 0, route: undefined, obligations: [] },
    { ...screen("favorites-store", "", []), kind: "shared", wave: 0, route: undefined, obligations: [] },
    screen("recipe-list", "/recepti", ["api-client"]),
    screen("recipe-detail", "/recepti/:id", ["api-client", "favorites-store"]),
    screen("favorites", "/omiljeni", ["favorites-store"]),
    screen("categories", "/kategorije", ["api-client"]),
    screen("settings", "/podesavanja", []),
  ],
  flows: [
    { id: "add-to-favorites", description: "Detail → add to favorites → Favorites", unitIds: ["recipe-detail", "favorites"] },
  ],
  routeMap: { "/recepti": "/recepti", "/recepti/:id": "/recepti/[id]" },
}

describe("ScenarioSchema", () => {
  it("accepts the example from wemora-plan.md", () => {
    expect(ScenarioSchema.safeParse(exampleScenario).success).toBe(true)
  })

  it("rejects an unknown step", () => {
    const bad = { ...exampleScenario, steps: [{ click: { text: "Sačuvaj" } }] }
    expect(ScenarioSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects a step with two keys", () => {
    const bad = { ...exampleScenario, steps: [{ goto: "/narudzbine", tap: { text: "Sačuvaj" } }] }
    expect(ScenarioSchema.safeParse(bad).success).toBe(false)
  })
})

describe("PlanSchema", () => {
  it("accepts a hand-written plan for Recepti", () => {
    expect(PlanSchema.safeParse(receptiPlan).success).toBe(true)
  })

  it("rejects an unknown unit kind", () => {
    const bad = { ...receptiPlan, units: [{ ...receptiPlan.units[2], kind: "page" }] }
    expect(PlanSchema.safeParse(bad).success).toBe(false)
  })
})

describe("IntentionalDifferenceSchema", () => {
  it.each([
    { kind: "hiddenBehind", element: { label: "Status" }, reveal: { role: "button", name: "Filteri" } },
    { kind: "movedTo", what: "customer email", toUnit: "order-detail" },
    { kind: "notPortable", element: { role: "button", name: "Info" }, reason: "hover only" },
  ])("accepts $kind", (difference) => {
    expect(IntentionalDifferenceSchema.safeParse(difference).success).toBe(true)
  })

  it("rejects an unknown kind", () => {
    expect(IntentionalDifferenceSchema.safeParse({ kind: "resized", element: { text: "x" } }).success).toBe(false)
  })
})

describe("EventPayloadSchemas", () => {
  it("accepts an ID-only payload", () => {
    expect(EventPayloadSchemas["unit.promoted"].safeParse({ unitId: "u1" }).success).toBe(true)
  })

  it("rejects data in a payload", () => {
    const withData = { unitId: "u1", code: "export default function Screen() {}" }
    expect(EventPayloadSchemas["unit.promoted"].safeParse(withData).success).toBe(false)
  })

  it("has plan.failed with an empty payload (D-012)", () => {
    expect(EventPayloadSchemas["plan.failed"].safeParse({}).success).toBe(true)
    expect(EventPayloadSchemas["plan.failed"].safeParse({ errors: ["unit x has no route"] }).success).toBe(false)
  })
})
