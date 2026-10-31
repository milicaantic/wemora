import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import type { Flow, InteractiveElement, Plan, Scenario, Unit } from "../contracts"
import {
  coverageNote,
  flowAsUnit,
  flowBrief,
  flowTestsFile,
  matchesRoute,
  openablePath,
  readFlowTests,
  readTests,
  scenarioProblem,
  testerBrief,
  testsFile,
  writeFlowTests,
  writeTests,
} from "./tester"

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

  it("refuses a goto to another screen in setup or steps, but not in a flow test (A's inbox 2026-10-31)", () => {
    // favorites made its state on the list: it could not pass before the list was in the app.
    const fromList: Scenario = { ...save, setup: [{ goto: "/" }, { tap: { role: "button", name: "Dodaj u omiljene" } }] }
    expect(scenarioProblem(fromList, unit, [])).toContain('"goto /" opens another screen; a test of this screen opens only /narudzbine')
    expect(scenarioProblem({ ...save, steps: [{ goto: "/kupovina" }, ...save.steps.slice(1)] }, unit, [])).toContain("opens another screen")
    expect(scenarioProblem({ ...save, steps: [{ goto: "/narudzbine?q=Petar" }, ...save.steps.slice(1)] }, unit, [])).toBeNull()
    expect(scenarioProblem({ ...fromList, flowId: "f" }, unit, [], "f")).toBeNull()
  })

  it("refuses a tap on a link to another screen in setup or before the last action, not as the last action", () => {
    // Like favorites in the run of 21:18: "Recepti" in the menu, a favorite added on the list, back to "Omiljeni".
    const links = [
      { name: "Recepti", path: "/" },
      { name: "Narudžbine", path: "/narudzbine" },
    ]
    const viaMenu: Scenario = { ...save, setup: [{ goto: "/narudzbine" }, { tap: { role: "link", name: "Recepti" } }] }
    expect(scenarioProblem(viaMenu, unit, [], undefined, links)).toContain('Tapping link "Recepti" in setup opens another screen (/)')
    const actsThere: Scenario = {
      ...save,
      steps: [{ goto: "/narudzbine" }, { tap: { text: "Recepti" } }, { tap: { role: "button", name: "Sačuvaj" } }, { expectVisible: { text: "Sačuvano" } }],
    }
    expect(scenarioProblem(actsThere, unit, [], undefined, links)).toContain('Tapping link "Recepti" at step 1')
    // Leaving as the last action, then checking this screen is gone, stays allowed; so does a link to this screen.
    const leaves: Scenario = { ...save, steps: [{ goto: "/narudzbine" }, { tap: { role: "link", name: "Recepti" } }, { expectNotVisible: { text: "Pretraga" } }] }
    expect(scenarioProblem(leaves, unit, [], undefined, links)).toBeNull()
    const sameScreen: Scenario = { ...save, setup: [{ goto: "/narudzbine" }, { tap: { role: "link", name: "Narudžbine" } }] }
    expect(scenarioProblem(sameScreen, unit, [], undefined, links)).toBeNull()
    // A flow test may go anywhere.
    expect(scenarioProblem({ ...viaMenu, flowId: "f" }, unit, [], "f", links)).toBeNull()
  })

  it("refuses a notPortable element in steps and in setup, by role and name or by text", () => {
    const byRole: Scenario = { ...save, steps: [{ goto: "/narudzbine" }, { tap: { role: "button", name: "Info" } }] }
    const inSetup: Scenario = { ...search, setup: [{ goto: "/narudzbine" }, { tap: { text: "Info" } }] }
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

  it("explains route parameters, and names the real path when the tester found one", () => {
    expect(testerBrief({ ...unit, route: "/recepti/:id" }, [], [])).toContain("open it with real values")
    expect(testerBrief({ ...unit, route: "/recepti/:id" }, interactive, [], "/recepti/1")).toContain("open it at /recepti/1 (a real link in the app)")
  })

  it("tells where to open a catch-all route", () => {
    expect(testerBrief({ ...unit, route: "*" }, [], [])).toContain("open it at /")
    expect(testerBrief(unit, [], [])).not.toContain("open it at")
  })
})

describe("matchesRoute", () => {
  it("matches parameters, catch-alls and ignores query and hash", () => {
    expect(matchesRoute("/", "/")).toBe(true)
    expect(matchesRoute("/", "/?q=sarma")).toBe(true)
    expect(matchesRoute("/", "/omiljeni")).toBe(false)
    expect(matchesRoute("/omiljeni", "/")).toBe(false)
    expect(matchesRoute("/recepti/:id", "/recepti/1")).toBe(true)
    expect(matchesRoute("/recepti/:id", "/recepti")).toBe(false)
    expect(matchesRoute("*", "/#/active")).toBe(true)
    expect(matchesRoute("/docs/*", "/docs/a/b")).toBe(true)
    expect(matchesRoute("/docs/*", "/blog")).toBe(false)
  })
})

describe("openablePath", () => {
  it("opens a catch-all at its prefix, keeps plain paths and refuses parameters", () => {
    expect(openablePath("*")).toBe("/")
    expect(openablePath("/docs/*")).toBe("/docs/")
    expect(openablePath("/kupovina")).toBe("/kupovina")
    expect(openablePath("/")).toBe("/")
    expect(openablePath("/recepti/:id")).toBeNull()
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

// A flow from the orders list to one order (D-022).
const details: Unit = {
  ...unit,
  id: "order-details",
  route: "/narudzbine/:id",
  obligations: [{ id: "show", description: "Shows the order" }],
  intentionalDifferences: [{ kind: "notPortable", element: { role: "button", name: "Štampaj" }, reason: "no printing on mobile" }],
}
const flow: Flow = { id: "open-order", description: "Tapping #1043 in the list opens its details", unitIds: ["orders", "order-details"] }
const plan: Plan = { units: [unit, details], flows: [flow], routeMap: {} }
const flowTest: Scenario = {
  id: "open-order-1043",
  unitId: "orders",
  obligation: "open-order",
  flowId: "open-order",
  steps: [{ goto: "/narudzbine" }, { tap: { role: "link", name: "#1043" } }, { expectVisible: { text: "Detalji" } }],
}

describe("flow tests (D-022)", () => {
  it("sees a flow as its first unit, with the flow as the only obligation and every unit's differences", () => {
    const asUnit = flowAsUnit(flow, plan)
    expect(asUnit.id).toBe("orders")
    expect(asUnit.route).toBe("/narudzbine")
    expect(asUnit.obligations).toEqual([{ id: "open-order", description: flow.description }])
    expect(asUnit.intentionalDifferences.map((d) => (d.kind === "notPortable" ? d.element.name : ""))).toEqual(["Info", "Štampaj"])
  })

  it("refuses a flow that names a missing unit or does not start on a screen with a route", () => {
    expect(() => flowAsUnit({ ...flow, unitIds: ["orders", "nope"] }, plan)).toThrow('names unit "nope"')
    const shared: Unit = { ...unit, id: "data", kind: "shared", route: undefined }
    expect(() => flowAsUnit({ ...flow, unitIds: ["data", "orders"] }, { ...plan, units: [shared, unit] })).toThrow("must start with a screen")
  })

  it("requires flowId on a flow test and refuses it on a screen test", () => {
    const asUnit = flowAsUnit(flow, plan)
    expect(scenarioProblem(flowTest, asUnit, [], "open-order")).toBeNull()
    expect(scenarioProblem({ ...flowTest, flowId: undefined }, asUnit, [], "open-order")).toBe('flowId must be "open-order" for this flow test.')
    expect(scenarioProblem({ ...search, flowId: "open-order" }, unit, [])).toContain("Leave flowId out")
    const printing: Scenario = { ...flowTest, steps: [...flowTest.steps, { tap: { role: "button", name: "Štampaj" } }] }
    expect(scenarioProblem(printing, asUnit, [], "open-order")).toContain('button "Štampaj", which does not exist on mobile')
  })

  it("briefs the flow: screens in order, the ids to use, saved screen tests and elements to avoid", () => {
    const brief = flowBrief(flow, plan, { orders: [search, save], "order-details": [] }, [])
    expect(brief).toContain("Flow: open-order")
    expect(brief).toContain("- orders: route /narudzbine\n- order-details: route /narudzbine/:id")
    expect(brief).toContain('unitId "orders", obligation "open-order" and flowId "open-order"')
    expect(brief).toContain("- orders-search: ")
    expect(brief).toContain('- button "Štampaj" (no printing on mobile)')
    expect(brief).toContain("No scenario is saved for this flow yet.")
    expect(flowBrief(flow, plan, {}, [flowTest])).toContain("Already saved for this flow: open-order-1043")
  })

  it("writes tests/flows/<flowId>.json and reads it back", () => {
    const runDir = mkdtempSync(path.join(tmpdir(), "wemora-tests-"))
    expect(readFlowTests(runDir, "open-order")).toEqual([])
    writeFlowTests(runDir, "open-order", [flowTest])
    expect(flowTestsFile(runDir, "open-order")).toBe(path.join(runDir, "tests", "flows", "open-order.json"))
    expect(readFlowTests(runDir, "open-order")).toEqual([flowTest])
  })
})
