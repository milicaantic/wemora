import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { PlanSchema, type Plan, type Unit } from "../contracts"
import { parseApp, validatePlan } from "./index"

const repo = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const manual = PlanSchema.parse(JSON.parse(readFileSync(repo("examples/recepti/wemora/plan.manual.json"), "utf8")))
const recepti = await parseApp(repo("examples/recepti"))

/** Validates a copy of the manual plan after `change` edits it. */
const check = (change: (plan: Plan) => void) => {
  const plan = structuredClone(manual)
  change(plan)
  return validatePlan(plan, recepti)
}
const unit = (plan: Plan, id: string): Unit => {
  const found = plan.units.find((u) => u.id === id)
  if (!found) throw new Error(`no unit ${id}`)
  return found
}
const expectError = (errors: string[], ...parts: string[]) => {
  expect(errors.some((e) => parts.every((p) => e.includes(p))), `no error with ${parts.join(" + ")} in:\n${errors.join("\n")}`).toBe(true)
}

describe("validatePlan on the hand-written Recepti plan", () => {
  it("accepts it as is", () => {
    expect(validatePlan(manual, recepti)).toEqual([])
  })

  it("does not change the plan it checks", () => {
    const copy = structuredClone(manual)
    validatePlan(copy, recepti)
    expect(copy).toEqual(manual)
  })
})

describe("validatePlan catches broken plans", () => {
  it("a route with no screen", () => {
    const errors = check((p) => {
      p.units = p.units.filter((u) => u.id !== "shopping-list")
      p.flows = p.flows.filter((f) => !f.unitIds.includes("shopping-list"))
    })
    expectError(errors, `route "/kupovina"`, "not covered")
  })

  it("a file in two units, naming both", () => {
    const errors = check((p) => unit(p, "recipe-list").sources.push("src/api/client.ts"))
    expectError(errors, `"src/api/client.ts"`, `"data"`, `"recipe-list"`, "at most one unit")
  })

  it("a dependency on an unknown unit", () => {
    expectError(check((p) => unit(p, "favorites").dependsOn.push("nepostoji")), `"favorites"`, `unknown unit "nepostoji"`)
  })

  it("a dependency cycle, with the path", () => {
    const errors = check((p) => {
      unit(p, "recipe-detail").dependsOn.push("favorites")
      unit(p, "favorites").dependsOn.push("recipe-detail")
    })
    expectError(errors, "dependency cycle", "favorites -> recipe-detail -> favorites")
  })

  it("a screen in wave 0", () => {
    expectError(check((p) => (unit(p, "categories").wave = 0)), `screen unit "categories"`, "wave 1 or later")
  })

  it("a screen in the same wave as the screen it depends on", () => {
    expectError(check((p) => unit(p, "favorites").dependsOn.push("recipe-detail")), `"favorites" (wave 1)`, `"recipe-detail" (wave 1)`)
  })

  it("a shared unit outside wave 0 or depending on a screen", () => {
    const errors = check((p) => {
      unit(p, "layout").wave = 1
      unit(p, "data").dependsOn.push("favorites")
    })
    expectError(errors, `shared unit "layout" must be in wave 0`)
    expectError(errors, `shared unit "data" must not depend on screen unit "favorites"`)
  })

  it("a routeMap without a route, with a raw param, or with an extra key", () => {
    const errors = check((p) => {
      delete p.routeMap["/recepti/:id"]
      p.routeMap["/kategorije"] = "/kategorije/:x"
      p.routeMap["/nema"] = "/nema"
    })
    expectError(errors, `routeMap has no entry for route "/recepti/:id"`)
    expectError(errors, `routeMap["/kategorije"]`, `"[param]"`)
    expectError(errors, `entry for "/nema"`)
  })

  it("a routeMap that drops a param or maps two routes to one path", () => {
    const errors = check((p) => {
      p.routeMap["/recepti/:id"] = "/recepti"
      p.routeMap["/omiljeni"] = "/kupovina"
    })
    expectError(errors, `missing the param "[id]"`)
    expectError(errors, `both map to "/kupovina"`)
  })

  it("an unknown kind as a schema error, without throwing", () => {
    const errors = check((p) => ((unit(p, "favorites") as { kind: string }).kind = "page"))
    const index = manual.units.findIndex((u) => u.id === "favorites")
    expectError(errors, `plan does not match the schema at units.${index}.kind`)
  })

  it("input that is not a plan at all", () => {
    expect(() => validatePlan(null as unknown as Plan, recepti)).not.toThrow()
    expectError(validatePlan(null as unknown as Plan, recepti), "plan does not match the schema")
  })

  it("a source that is not a file of the app, and a missing component file", () => {
    const errors = check((p) => {
      const list = unit(p, "recipe-list")
      list.sources = list.sources.filter((s) => s !== "src/pages/RecipeListPage.tsx")
      list.sources.push("src\\pages\\RecipeListPage.tsx")
    })
    expectError(errors, `source "src\\pages\\RecipeListPage.tsx"`, "not a file of the app")
    expectError(errors, `"recipe-list"`, `component file "src/pages/RecipeListPage.tsx"`)
  })

  it("a screen with a route the app does not have", () => {
    expectError(check((p) => (unit(p, "categories").route = "/kategorija")), `route "/kategorija", which the app does not have`)
  })

  it("kind and route that do not go together", () => {
    const errors = check((p) => {
      unit(p, "data").route = "/"
      delete unit(p, "categories").route
    })
    expectError(errors, `shared unit "data" must not have a route`)
    expectError(errors, `screen unit "categories" has no route`)
  })

  it("unit ids that are duplicated or not kebab-case", () => {
    const errors = check((p) => {
      unit(p, "favorites").id = "Omiljeni Recepti"
      p.units.push({ ...structuredClone(unit(p, "data")), sources: [], writes: ["src/shared/data/"] })
    })
    expectError(errors, `unit id "Omiljeni Recepti" must be kebab-case`)
    expectError(errors, `unit id "data" is used more than once`)
  })

  it("writes outside the unit's folder and writes shared by two units", () => {
    const errors = check((p) => {
      unit(p, "favorites").writes = ["src/screens/favorites/", "src/screens/categories/x.tsx", "src/app/_layout.tsx"]
      unit(p, "data").writes = []
    })
    expectError(errors, `"favorites" writes "src/app/_layout.tsx"`, "outside its folder")
    expectError(errors, `"categories" and "favorites" both write under`)
    expectError(errors, `unit "data" has no writes`)
  })

  it("lets only the shared unit layout write the root layout src/app/_layout.tsx (C, PD3/PD4)", () => {
    expect(check((p) => void unit(p, "layout").writes.push("src/app/_layout.tsx"))).toEqual([])
    const errors = check((p) => {
      unit(p, "layout").writes.push("src/app/other.tsx")
      unit(p, "recipe-list").writes.push("src/app/_layout.tsx")
    })
    expectError(errors, `"layout" writes "src/app/other.tsx"`, "outside its folder")
    expectError(errors, `"recipe-list" writes "src/app/_layout.tsx"`, "outside its folder")
  })

  it("obligations a test cannot do on the original web: gestures and notPortable elements", () => {
    const errors = check((p) => {
      unit(p, "recipe-list").obligations.push(
        { id: "edit-on-hold", description: "Long-pressing a recipe reveals an edit field." },
        { id: "row-details", description: "Hovering a row shows 'Sastojci' with the ingredients." },
        { id: "quick-edit", description: "Double-clicking a name opens the editor." },
      )
      unit(p, "shopping-list").obligations.push({ id: "reorder", description: "Dragging 'Hleb' above 'Mleko' changes the order." })
    })
    expectError(errors, `obligation "edit-on-hold" of unit "recipe-list" needs a long press`, "goto, tap, fill, submit")
    expectError(errors, `obligation "row-details" of unit "recipe-list" needs mouse hover`)
    expectError(errors, `obligation "quick-edit" of unit "recipe-list" needs a double click`)
    expectError(errors, `obligation "reorder" of unit "shopping-list" needs dragging or swiping`)
    // 'Sastojci' is the recipe-list tooltip marked notPortable in the hand-written plan.
    expectError(errors, `obligation "row-details" of unit "recipe-list" uses 'Sastojci', which the same unit marks notPortable`)
  })

  it("obligations that check an order or count items (A, G3)", () => {
    const errors = check((p) => {
      unit(p, "recipe-list").obligations.push({
        id: "sort-by-time",
        description: "Tapping 'Sortiraj po vremenu' orders recipes from the shortest to the longest time; tapping it again restores the original order.",
      })
      unit(p, "shopping-list").obligations.push({ id: "no-duplicate", description: "Adding 'Hleb' twice does not add a duplicate." })
      unit(p, "favorites").obligations.push({ id: "sorted", description: "Favorites are sorted by name." })
    })
    expectError(errors, `obligation "sort-by-time" of unit "recipe-list" checks an order of items`, "a text appears or disappears")
    expectError(errors, `obligation "no-duplicate" of unit "shopping-list" checks counting items`)
    expectError(errors, `obligation "sorted" of unit "favorites" checks an order of items`)
  })

  it("obligations that look at another screen (A: recipe-list and recipe-detail blocked each other)", () => {
    const errors = check((p) => {
      unit(p, "recipe-detail").obligations.push({ id: "back-to-list", description: "Tapping 'Nazad na recepte' navigates back to the recipe list screen (the '/' route)." })
      unit(p, "categories").obligations.push({ id: "open-it", description: "Tapping 'Pileća supa' opens the recipe detail screen." })
    })
    expectError(errors, `obligation "back-to-list" of unit "recipe-detail" checks what another screen shows`, "put what the other screen shows into a flow")
    expectError(errors, `obligation "open-it" of unit "categories" checks what another screen shows`)
    expect(check((p) => void unit(p, "recipe-detail").obligations.push({ id: "leave", description: "Tapping 'Nazad na recepte' leaves the detail ('Nazad na recepte' is no longer shown)." }))).toEqual([])
  })

  it("does not take data words or quoted texts as an order or a count", () => {
    const errors = check((p) => {
      unit(p, "favorites").obligations.push({ id: "orders-link", description: "Tapping 'Orders' shows 'Order #12' and 'Sort by price'." })
      unit(p, "shopping-list").obligations.push({ id: "counter", description: "Adding 'Hleb' changes the counter to 'Kupljeno: 0 od 1'." })
    })
    expect(errors).toEqual([])
  })

  it("does not read gesture words inside quoted screen texts", () => {
    const errors = check((p) => {
      unit(p, "shopping-list").obligations.push({ id: "odd-labels", description: "Tapping 'Drag me' shows 'Hover over here' and \"Double click\"." })
    })
    expect(errors).toEqual([])
  })

  it("obligation problems", () => {
    const errors = check((p) => {
      unit(p, "categories").obligations = []
      unit(p, "data").obligations = [{ id: "loads", description: "Loads recipes" }]
      unit(p, "favorites").obligations.push({ id: "Empty State", description: "x" }, { id: "empty-state", description: "y" })
    })
    expectError(errors, `screen unit "categories" has no obligations`)
    expectError(errors, `shared unit "data" must not have obligations`)
    expectError(errors, `obligation id "Empty State"`, "kebab-case")
    expectError(errors, `obligation id "empty-state" more than once`)
  })

  it("intentional differences on a shared unit or moved to a wrong unit", () => {
    const errors = check((p) => {
      unit(p, "layout").intentionalDifferences = [{ kind: "movedTo", what: "menu", toUnit: "recipe-list" }]
      unit(p, "recipe-list").intentionalDifferences.push(
        { kind: "movedTo", what: "rating", toUnit: "nepostoji" },
        { kind: "movedTo", what: "time", toUnit: "data" },
      )
    })
    expectError(errors, `shared unit "layout" must not have intentional differences`)
    expectError(errors, `moves "rating" to unknown unit "nepostoji"`)
    expectError(errors, `moves "time" to shared unit "data"`)
  })

  it("flows with unknown or shared units", () => {
    const errors = check((p) => {
      p.flows.push({ id: "bad-flow", description: "x", unitIds: ["recipe-list", "nepostoji"] })
      p.flows.push({ id: "shared-flow", description: "x", unitIds: ["recipe-list", "data"] })
    })
    expectError(errors, `flow "bad-flow" uses unknown unit "nepostoji"`)
    expectError(errors, `flow "shared-flow" uses shared unit "data"`)
  })

  it("lists errors in rule order, the same way every time", () => {
    const broken = (p: Plan) => {
      delete p.routeMap["/"]
      unit(p, "categories").wave = 0
      unit(p, "recipe-list").sources.push("src/api/client.ts")
    }
    const errors = check(broken)
    expect(errors).toEqual(check(broken))
    const at = (text: string) => errors.findIndex((e) => e.includes(text))
    expect(at("at most one unit")).toBeLessThan(at("wave 1 or later"))
    expect(at("wave 1 or later")).toBeLessThan(at("routeMap has no entry"))
  })
})

describe("validatePlan on TodoMVC", async () => {
  const todomvc = await parseApp(repo("examples/todomvc"))
  const route = todomvc.routes[0]!
  const plan: Plan = {
    units: [
      { id: "entry", kind: "shared", wave: 0, sources: todomvc.sharedFiles, writes: ["src/shared/entry/"], dependsOn: [], obligations: [], intentionalDifferences: [], size: 0 },
      {
        id: "todos",
        kind: "screen",
        wave: 1,
        route: "*",
        sources: route.files,
        writes: ["src/screens/todos/"],
        dependsOn: ["entry"],
        obligations: [{ id: "add-todo", description: "Adding a todo shows it in the list" }],
        intentionalDifferences: [{ kind: "notPortable", element: { role: "textbox", name: "Edit todo" }, reason: "edit starts on double click" }],
        size: route.tokens,
      },
    ],
    flows: [],
    routeMap: { "*": "/" },
  }

  it("accepts a plan for the catch-all route", () => {
    expect(validatePlan(plan, todomvc)).toEqual([])
  })
})
