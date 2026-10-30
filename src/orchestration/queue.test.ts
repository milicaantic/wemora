import { describe, expect, it } from "vitest"
import type { Plan, Scenario, Unit, UnitState, UnitStatus } from "../contracts"
import { blockedBy, isFinished, nextForBuilder, nextForTester, readyUnits, unlockedBy, type QueueView } from "./queue"

const unit = (id: string, kind: Unit["kind"], wave: number, dependsOn: string[], size: number): Unit => ({
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

// Recepti-like plan: 2 shared units in wave 0, 5 screens in wave 1, 1 screen in wave 2.
const plan: Plan = {
  units: [
    unit("api", "shared", 0, [], 2000),
    unit("store", "shared", 0, [], 1000),
    unit("list", "screen", 1, ["api"], 5000),
    unit("detail", "screen", 1, ["api", "store"], 4000),
    unit("favorites", "screen", 1, ["store"], 3000),
    unit("categories", "screen", 1, ["api"], 3000),
    unit("settings", "screen", 1, ["store"], 1000),
    unit("edit", "screen", 2, ["detail"], 2000),
  ],
  flows: [
    { id: "add-favorite", description: "detail → favorites", unitIds: ["detail", "favorites"] },
    { id: "open-recipe", description: "list → detail", unitIds: ["list", "detail"] },
  ],
  routeMap: {},
}

const state = (status: UnitStatus): UnitState => ({ status, round: 0, model: null, builderId: null, testerId: null, testAttempts: 0 })
const scenario = (unitId: string): Scenario => ({ id: `${unitId}-t`, unitId, obligation: "o", steps: [{ goto: `/${unitId}` }] })

function view(statuses: Record<string, UnitStatus> = {}, withTests: string[] = []): QueueView {
  return {
    plan,
    units: Object.fromEntries(Object.entries(statuses).map(([id, status]) => [id, state(status)])),
    tests: Object.fromEntries(withTests.map((id) => [id, [scenario(id)]])),
  }
}

const ids = (units: Unit[]) => units.map((u) => u.id)
const sharedDone = { api: "promoted", store: "promoted" } as const

describe("readyUnits and nextForBuilder", () => {
  it("starts with wave 0 only, bigger first", () => {
    expect(ids(readyUnits(view()))).toEqual(["api", "store"])
    expect(nextForBuilder(view())?.id).toBe("api")
  })

  it("skips units that are already being built, submitted or finished", () => {
    expect(ids(readyUnits(view({ api: "building", store: "submitted" })))).toEqual([])
  })

  it("orders by flows, then by size (§9 rules 3 and 4)", () => {
    // detail is in 2 flows; list and favorites in 1 (list is bigger); categories and settings in none.
    expect(ids(readyUnits(view(sharedDone)))).toEqual(["detail", "list", "favorites", "categories", "settings"])
  })

  it("puts units whose tests already exist first (§9 rule 2)", () => {
    expect(ids(readyUnits(view(sharedDone, ["settings", "categories"])))).toEqual([
      "categories",
      "settings",
      "detail",
      "list",
      "favorites",
    ])
  })

  it("never offers a unit before all its dependencies are promoted", () => {
    const ready = ids(readyUnits(view({ api: "promoted", store: "building" })))
    expect(ready).toEqual(["list", "categories"])
    expect(ready).not.toContain("edit")
  })
})

describe("nextForTester", () => {
  it("offers screens from every wave from the start, never shared units", () => {
    const offered: string[] = []
    let next: Unit | undefined
    while ((next = nextForTester(view(), new Set(offered)))) offered.push(next.id)

    expect(offered).toEqual(["detail", "list", "favorites", "categories", "edit", "settings"])
  })

  it("skips screens that have tests, are being tested, or are finished", () => {
    const v = view({ list: "promoted", favorites: "failed" }, ["detail"])
    expect(nextForTester(v, new Set(["categories"]))?.id).toBe("edit")
  })

  it("treats an empty test list as no tests", () => {
    const v: QueueView = { ...view(), tests: { detail: [] } }
    expect(nextForTester(v, new Set())?.id).toBe("detail")
  })
})

describe("unlockedBy", () => {
  it("releases the screens whose last dependency was just promoted", () => {
    expect(ids(unlockedBy(view({ api: "promoted" }), "api"))).toEqual(["list", "categories"])
    expect(ids(unlockedBy(view(sharedDone), "store"))).toEqual(["detail", "favorites", "settings"])
  })

  it("works when the board does not show the promotion yet", () => {
    expect(ids(unlockedBy(view({ store: "promoted" }), "api"))).toEqual(["list", "detail", "categories"])
  })

  it("does not release wave 2 until its screen dependency is promoted", () => {
    expect(ids(unlockedBy(view(sharedDone), "store"))).not.toContain("edit")
    expect(ids(unlockedBy(view({ ...sharedDone, detail: "promoted" }), "detail"))).toEqual(["edit"])
  })
})

describe("blockedBy", () => {
  it("returns every waiting unit that depends on a failed unit, directly or not", () => {
    expect(ids(blockedBy(view({ api: "promoted", store: "failed" }), "store"))).toEqual(["detail", "favorites", "settings", "edit"])
  })

  it("leaves units that are already finished or in progress alone", () => {
    const v = view({ ...sharedDone, list: "promoted", categories: "building", detail: "failed" })
    expect(ids(blockedBy(v, "detail"))).toEqual(["edit"])
  })
})

describe("isFinished", () => {
  it("is true only when every unit is promoted or failed", () => {
    const allButOne = Object.fromEntries(plan.units.map((u) => [u.id, "promoted" as const]))
    expect(isFinished(view())).toBe(false)
    expect(isFinished(view({ ...allButOne, edit: "submitted" }))).toBe(false)
    expect(isFinished(view({ ...allButOne, edit: "failed" }))).toBe(true)
  })

  it("is false without a plan", () => {
    expect(isFinished({ plan: null, units: {}, tests: {} })).toBe(false)
  })
})
