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
  normalizePlan,
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
    expect(plan.units.map((u) => u.id)).toEqual(["data", "layout", "categories", "favorites", "recipe-detail", "recipe-list", "shopping-list"])
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
