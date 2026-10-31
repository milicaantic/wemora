import { describe, expect, it } from "vitest"
import { EventPayloadSchemas, FlowResultSchema, IntentionalDifferenceSchema, PlanSchema, ScenarioSchema, type Plan } from "./index"

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

  it("accepts a flow test: flowId, the flow's first unit and the flow as obligation (D-022)", () => {
    const flowTest = { ...exampleScenario, id: "favorite-flow-1", unitId: "recipe-detail", obligation: "add-to-favorites", flowId: "add-to-favorites" }
    expect(ScenarioSchema.safeParse(flowTest).success).toBe(true)
    expect(ScenarioSchema.safeParse({ ...flowTest, flowId: "" }).success).toBe(false)
  })

  it("accepts submit (type and press Enter, D-017) with a label and a value only", () => {
    const addTodo = { ...exampleScenario, steps: [{ goto: "/" }, { submit: { label: "New Todo Input", value: "Buy milk" } }] }
    expect(ScenarioSchema.safeParse(addTodo).success).toBe(true)
    const extra = { ...exampleScenario, steps: [{ submit: { label: "New Todo Input", value: "x", key: "Enter" } }] }
    expect(ScenarioSchema.safeParse(extra).success).toBe(false)
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

describe("FlowResultSchema", () => {
  it("accepts a flow result with its scenario results (D-022)", () => {
    const result = {
      flowId: "add-to-favorites",
      ok: false,
      scenarios: [{ scenarioId: "favorite-flow-1", unitId: "recipe-detail", ok: false, failedStep: 3, error: "not found", durationMs: 812 }],
    }
    expect(FlowResultSchema.safeParse(result).success).toBe(true)
    expect(FlowResultSchema.safeParse({ ...result, rolledBack: ["favorites"] }).success).toBe(false)
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

  it("has tests.missing with only the unit ID (D-016)", () => {
    expect(EventPayloadSchemas["tests.missing"].safeParse({ unitId: "recipe-list" }).success).toBe(true)
    expect(EventPayloadSchemas["tests.missing"].safeParse({ unitId: "recipe-list", attempts: 2 }).success).toBe(false)
  })

  it("has flow.tests.ready with only the flow ID (D-022)", () => {
    expect(EventPayloadSchemas["flow.tests.ready"].safeParse({ flowId: "add-to-favorites" }).success).toBe(true)
    expect(EventPayloadSchemas["flow.tests.ready"].safeParse({ flowId: "add-to-favorites", unitId: "favorites" }).success).toBe(false)
  })

  it("has plan.failed with an empty payload (D-012)", () => {
    expect(EventPayloadSchemas["plan.failed"].safeParse({}).success).toBe(true)
    expect(EventPayloadSchemas["plan.failed"].safeParse({ errors: ["unit x has no route"] }).success).toBe(false)
  })
})
