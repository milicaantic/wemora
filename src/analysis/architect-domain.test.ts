import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { PlanSchema, type Plan } from "../contracts"
import {
  ArchitectOutputSchema,
  architectBrief,
  architectRetryMessage,
  expoRouteFor,
  fallbackReports,
  globalStylesheets,
  hasGlobalRules,
  normalizePlan,
  packageStylesheets,
  parseApp,
  validatePlan,
  type ArchitectOutput,
} from "./index"

const repo = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const recepti = await parseApp(repo("examples/recepti"))
const manual = PlanSchema.parse(JSON.parse(readFileSync(repo("examples/recepti/wemora/plan.manual.json"), "utf8")))
const byId = (plan: Plan, id: string) => plan.units.find((u) => u.id === id)!
/** The manual plan as the model would send it: no routeMap. */
const modelOutput = (): ArchitectOutput => {
  const { routeMap: _routeMap, ...rest } = structuredClone(manual)
  return rest
}

describe("expoRouteFor", () => {
  it.each([
    ["/", ["/"], "/"],
    ["/kategorije", ["/", "/kategorije"], "/kategorije"],
    ["/recepti/:id", ["/", "/recepti/:id"], "/recepti/[id]"],
    ["/users/:userId/posts/:postId", ["/"], "/users/[userId]/posts/[postId]"],
    ["/lang/:lang?", ["/"], "/lang/[lang]"],
    ["/docs/*", ["/", "/docs/*"], "/docs/[...rest]"],
    ["*", ["*"], "/"],
    ["*", ["/", "*"], "/[...rest]"],
  ])("%s → %s", (web, all, expo) => {
    expect(expoRouteFor(web, all)).toBe(expo)
  })
})

describe("normalizePlan", () => {
  it("keeps the hand-written plan valid and only reorders it", () => {
    const plan = normalizePlan(manual, recepti)
    expect(validatePlan(plan, recepti)).toEqual([])
    expect(plan.routeMap).toEqual(manual.routeMap)
    for (const unit of manual.units) {
      const normalized = byId(plan, unit.id)
      expect(normalized.size).toBe(unit.size)
      expect(normalized.wave).toBe(unit.wave)
      expect(normalized.sources).toEqual([...unit.sources].sort())
    }
    expect(plan.units.map((u) => u.id)).toEqual(["data", "layout", "theme", "categories", "favorites", "recipe-detail", "recipe-list", "shopping-list"])
  })

  it("is idempotent", () => {
    const once = normalizePlan(manual, recepti)
    expect(normalizePlan(once, recepti)).toEqual(once)
  })

  it("does not change its input", () => {
    const input = structuredClone(manual)
    normalizePlan(input, recepti)
    expect(input).toEqual(manual)
  })

  it("turns model output without routeMap into a valid plan", () => {
    const output = ArchitectOutputSchema.parse(modelOutput())
    const plan = normalizePlan(output, recepti)
    expect(plan.routeMap).toEqual(manual.routeMap)
    expect(validatePlan(plan, recepti)).toEqual([])
  })

  it("recomputes size and waves, and fills empty writes", () => {
    const output = modelOutput()
    byId(output as Plan, "recipe-list").size = 1
    byId(output as Plan, "data").wave = 3
    byId(output as Plan, "favorites").wave = 0
    byId(output as Plan, "categories").writes = []
    const plan = normalizePlan(output, recepti)
    expect(byId(plan, "recipe-list").size).toBe(1390)
    expect(byId(plan, "data").wave).toBe(0)
    expect(byId(plan, "favorites").wave).toBe(1)
    expect(byId(plan, "categories").writes).toEqual(["src/screens/categories/"])
  })

  it("puts a screen that depends on another screen in wave 2", () => {
    const output = modelOutput()
    byId(output as Plan, "favorites").dependsOn.push("recipe-detail")
    const plan = normalizePlan(output, recepti)
    expect(byId(plan, "favorites").wave).toBe(2)
    expect(validatePlan(plan, recepti)).toEqual([])
  })

  it("normalizes source paths and drops files the app does not have", () => {
    const output = modelOutput()
    byId(output as Plan, "recipe-list").sources = ["src\\pages\\RecipeListPage.tsx", "./src/pages/RecipeListPage.css", "src/nope.ts", "../secret.txt"]
    const unit = byId(normalizePlan(output, recepti), "recipe-list")
    expect(unit.sources).toEqual(["src/pages/RecipeListPage.css", "src/pages/RecipeListPage.tsx"])
  })

  it("keeps the model's routeMap entries and drops keys that are not routes", () => {
    const output = { ...modelOutput(), routeMap: { "/kategorije": "/kategorije-svi", "/nema": "/nema" } }
    const plan = normalizePlan(output, recepti)
    expect(plan.routeMap["/kategorije"]).toBe("/kategorije-svi")
    expect(plan.routeMap["/recepti/:id"]).toBe("/recepti/[id]")
    expect(plan.routeMap).not.toHaveProperty("/nema")
  })

  it("leaves problems it cannot fix for validatePlan, and does not loop on a cycle", () => {
    const output = modelOutput()
    byId(output as Plan, "favorites").dependsOn.push("recipe-detail")
    byId(output as Plan, "recipe-detail").dependsOn.push("favorites")
    byId(output as Plan, "recipe-list").sources.push("src/api/client.ts")
    const errors = validatePlan(normalizePlan(output, recepti), recepti)
    expect(errors.some((e) => e.includes("dependency cycle"))).toBe(true)
    expect(errors.some((e) => e.includes(`"src/api/client.ts"`))).toBe(true)
  })

  it("model output schema has no routeMap, so no open-ended object goes to structured output", () => {
    const json = JSON.stringify(z.toJSONSchema(ArchitectOutputSchema))
    expect(json).not.toContain("routeMap")
    expect(json).not.toContain("propertyNames")
  })
})

describe("architect messages", () => {
  const reports = fallbackReports(recepti, "part-1", "timeout")
  const brief = architectBrief(recepti, reports)

  it("brief lists every route, screen file and shared file, and the reports", () => {
    for (const route of recepti.routes) {
      expect(brief).toContain(`route "${route.path}"`)
      expect(brief).toContain(`"${route.file}"`)
    }
    for (const file of recepti.sharedFiles) expect(brief).toContain(`"${file}"`)
    expect(brief).toContain(`Analyzer reports (${reports.length})`)
    expect(brief).toContain('"screen": "RecipeListPage"')
  })

  it("brief warns about fallback reports", () => {
    expect(brief).toContain("are automatic fallbacks with no analysis")
    expect(architectBrief(recepti, [])).not.toContain("automatic fallbacks")
  })

  it("brief is the same for the same reports in any order", () => {
    expect(architectBrief(recepti, [...reports].reverse())).toBe(brief)
  })

  it("retry message repeats the brief, numbers the problems and includes the previous plan", () => {
    const message = architectRetryMessage(brief, { units: [] }, ["route \"/kupovina\" is not covered", "dependency cycle: a -> b -> a"])
    expect(message.startsWith(brief)).toBe(true)
    expect(message).toContain("Your previous plan has 2 problems:")
    expect(message).toContain('1. route "/kupovina" is not covered')
    expect(message).toContain('"units": []')
    expect(message).toContain("Return the full corrected plan")
  })
})

describe("theme unit (D-027)", async () => {
  const todomvc = await parseApp(repo("examples/todomvc"))

  it("finds global stylesheets: shared CSS with element rules, and package CSS the entry imports", () => {
    expect(globalStylesheets(recepti)).toEqual(["src/components/Layout.css"])
    // From the import statements in src/index.js, so the result does not depend on `npm ci` in the example.
    expect(packageStylesheets(todomvc)).toEqual(["node_modules/todomvc-app-css/index.css", "node_modules/todomvc-common/base.css"])
    expect(globalStylesheets(todomvc)).toEqual(packageStylesheets(todomvc))
  })

  it("tells element rules from rules of one part", () => {
    expect(hasGlobalRules("body { margin: 0 }")).toBe(true)
    expect(hasGlobalRules(".a, h1:hover { color: red }")).toBe(true)
    expect(hasGlobalRules("@media (max-width: 600px) { :root { --x: 1 } }")).toBe(true)
    expect(hasGlobalRules("/* body { } */ .sidebar a { color: red } .toolbar button { x: 1 }")).toBe(false)
  })

  it("accepts package stylesheets as sources, and makes every other unit depend on the theme", () => {
    const output: ArchitectOutput = {
      units: [
        { id: "theme", kind: "shared", wave: 0, sources: packageStylesheets(todomvc), writes: [], dependsOn: [], obligations: [], intentionalDifferences: [], size: 0 },
        { id: "app-entry", kind: "shared", wave: 0, sources: ["src/index.js"], writes: [], dependsOn: [], obligations: [], intentionalDifferences: [], size: 0 },
        {
          id: "todos",
          kind: "screen",
          wave: 1,
          route: "*",
          sources: todomvc.routes[0]!.files,
          writes: [],
          dependsOn: ["app-entry"],
          obligations: [{ id: "add-todo", description: "Typing 'Buy milk' in 'New Todo Input' and pressing Enter adds it." }],
          intentionalDifferences: [],
          size: 0,
        },
      ],
      flows: [],
    }
    const plan = normalizePlan(output, todomvc)
    expect(byId(plan, "theme").sources).toEqual(packageStylesheets(todomvc))
    expect(byId(plan, "theme").writes).toEqual(["src/shared/theme/"])
    expect(byId(plan, "theme").dependsOn).toEqual([])
    expect(byId(plan, "app-entry").dependsOn).toEqual(["theme"])
    expect(byId(plan, "todos").dependsOn).toEqual(["app-entry", "theme"])
    expect(byId(plan, "app-entry").wave).toBe(0)
    expect(validatePlan(plan, todomvc)).toEqual([])
    // Running it again changes nothing.
    expect(normalizePlan(plan, todomvc)).toEqual(plan)
  })

  it("adds no theme dependency when the plan has no theme unit", () => {
    const { units, flows } = modelOutput()
    const plan = normalizePlan({ units: units.filter((u) => u.id !== "theme").map((u) => ({ ...u, dependsOn: u.dependsOn.filter((d) => d !== "theme") })), flows }, recepti)
    expect(plan.units.every((u) => !u.dependsOn.includes("theme"))).toBe(true)
  })

  it("the brief lists the global stylesheets for the theme only when there are some", () => {
    const brief = architectBrief(todomvc, fallbackReports(todomvc, "part-1", "test"))
    expect(brief).toContain('Global stylesheets (fonts, sizes and colors for the whole app): "node_modules/todomvc-app-css/index.css", "node_modules/todomvc-common/base.css"')
    expect(brief).toContain('one shared unit with id "theme"')
    const noGlobal = { ...recepti, sharedFiles: recepti.sharedFiles.filter((f) => f !== "src/components/Layout.css") }
    expect(architectBrief(noGlobal, [])).not.toContain("Global stylesheets")
  })
})
