import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { PlanSchema, type ParsedApp } from "../contracts"
import { parseApp, UnsupportedInputError, type UnsupportedInputCode } from "./index"

const repo = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const mock = (name: string) => fileURLToPath(new URL(`./mocks/${name}`, import.meta.url))

const route = (app: ParsedApp, path: string) => {
  const found = app.routes.find((r) => r.path === path)
  if (!found) throw new Error(`no route ${path}; have ${app.routes.map((r) => r.path).join(", ")}`)
  return found
}

/** Every file listed by the parser appears exactly once (in one route or in sharedFiles). */
const expectEachFileOnce = (app: ParsedApp) => {
  const all = [...app.sharedFiles, ...app.routes.flatMap((r) => r.files)]
  expect(new Set(all).size).toBe(all.length)
}

const expectCode = async (dir: string, code: UnsupportedInputCode) => {
  const error = await parseApp(dir).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(UnsupportedInputError)
  expect((error as UnsupportedInputError).code).toBe(code)
}

describe("parseApp on examples/recepti", async () => {
  const app = await parseApp(repo("examples/recepti"))

  it("finds exactly the 5 screens, with nested paths joined", () => {
    expect(app.routes.map((r) => r.path)).toEqual(["/", "/kategorije", "/kupovina", "/omiljeni", "/recepti/:id"])
    expect(route(app, "/recepti/:id").file).toBe("src/pages/RecipeDetailPage.tsx")
  })

  it("treats the layout route, the entry and code used by 2+ screens as shared", () => {
    expect(app.sharedFiles).toContain("src/components/Layout.tsx")
    expect(app.sharedFiles).toContain("src/main.tsx")
    expect(app.sharedFiles).toContain("src/api/client.ts")
    expect(app.sharedFiles).toContain("src/store/shoppingList.ts") // detail + shopping list
    expect(route(app, "/").files).toEqual(["src/pages/RecipeListPage.css", "src/pages/RecipeListPage.tsx"])
  })

  it("reports web APIs per screen", () => {
    expect(route(app, "/").webApis).toEqual(expect.arrayContaining(["hover", "table"]))
    expect(route(app, "/omiljeni").webApis).not.toContain("table")
  })

  it("agrees with the hand-written plan: same files per unit and same sizes", () => {
    const plan = PlanSchema.parse(JSON.parse(readFileSync(repo("examples/recepti/wemora/plan.manual.json"), "utf8")))
    for (const unit of plan.units.filter((u) => u.kind === "screen")) {
      const r = route(app, unit.route!)
      expect(r.files).toEqual([...unit.sources].sort())
      expect(r.tokens).toBe(unit.size)
    }
    const sharedSources = plan.units.filter((u) => u.kind === "shared").flatMap((u) => u.sources)
    expect(app.sharedFiles).toEqual([...sharedSources].sort())
    expect(app.totalTokens).toBe(plan.units.reduce((sum, u) => sum + u.size, 0))
  })

  it("lists each file once, with forward slashes only", () => {
    expectEachFileOnce(app)
    expect(JSON.stringify({ ...app, webDir: "" })).not.toContain("\\\\")
  })

  it("returns one part with every route", () => {
    expect(app.parts).toHaveLength(1)
    expect(app.parts[0]!.routes).toEqual(app.routes.map((r) => r.path))
  })

  it("is deterministic", async () => {
    expect(JSON.stringify(await parseApp(repo("examples/recepti")))).toBe(JSON.stringify(app))
  })
})

describe("parseApp on examples/todomvc", async () => {
  const app = await parseApp(repo("examples/todomvc"))

  it("finds the single catch-all route of the HashRouter", () => {
    expect(app.routes.map((r) => r.path)).toEqual(["*"])
    expect(route(app, "*").file).toBe("src/todo/app.jsx")
    expect(app.sharedFiles).toEqual(["src/index.js"])
  })

  it("follows .js/.jsx imports and CSS, and ignores package imports", () => {
    const files = route(app, "*").files
    expect(files).toHaveLength(9)
    expect(files).toEqual(expect.arrayContaining(["src/todo/app.css", "src/todo/reducer.js", "src/todo/components/item.jsx"]))
    expect(files.some((f) => f.includes("node_modules"))).toBe(false)
    expectEachFileOnce(app)
  })

  it("sees keyboard and double-click behavior", () => {
    expect(route(app, "*").webApis).toEqual(expect.arrayContaining(["doubleclick", "keyboard"]))
  })
})

describe("parseApp on object routes (createBrowserRouter)", async () => {
  const app = await parseApp(mock("object-routes"))

  it("joins nested paths, keeps index routes, skips redirects and grouping routes", () => {
    expect(app.routes.map((r) => r.path)).toEqual(["/", "/about", "/admin/stats", "/settings", "/users/:userId"])
  })

  it("resolves element, Component and lazy targets", () => {
    expect(route(app, "/").file).toBe("src/pages/Home.jsx")
    expect(route(app, "/about").file).toBe("src/pages/About.jsx")
    expect(route(app, "/settings").file).toBe("src/pages/Settings.jsx")
  })

  it("puts layout code and code used by two screens in sharedFiles", () => {
    expect(app.sharedFiles).toEqual(["src/Root.jsx", "src/components/Nav.jsx", "src/main.jsx", "src/shared/Button.jsx"])
    expect(route(app, "/about").files).toEqual(["src/pages/About.css", "src/pages/About.jsx"])
    expect(route(app, "/about").webApis).toEqual(["hover", "table"])
    expect(route(app, "/").webApis).toEqual(["localStorage"])
  })

  it("gives a screen declared in the route file no files of its own", () => {
    expect(route(app, "/admin/stats").file).toBe("src/main.jsx")
    expect(route(app, "/admin/stats").files).toEqual([])
    expectEachFileOnce(app)
  })

  it("leaves out files nothing imports", () => {
    const all = [...app.sharedFiles, ...app.routes.flatMap((r) => r.files)]
    expect(all).not.toContain("src/pages/Unused.jsx")
  })
})

describe("parseApp on React.lazy routes", async () => {
  const app = await parseApp(mock("lazy-routes"))

  it("resolves lazy components, also inside <Suspense>", () => {
    expect(route(app, "/").file).toBe("src/pages/Home.jsx")
    expect(route(app, "/settings").file).toBe("src/pages/Settings.jsx")
  })

  it("shares a hook used by both lazy screens", () => {
    expect(app.sharedFiles).toEqual(["src/hooks/useThing.js", "src/index.jsx"])
    expect(route(app, "/settings").webApis).toEqual(["title-tooltip"])
  })
})

describe("parseApp rejects unsupported input", () => {
  it.each<[string, UnsupportedInputCode]>([
    ["next-app", "nextjs"],
    ["not-react", "not-react"],
    ["no-router", "no-router"],
    ["router-v5", "router-v5"],
    ["no-routes", "no-routes"],
    ["unresolved", "unresolved-route"],
    ["broken", "parse-error"],
  ])("%s → %s", async (name, code) => {
    await expectCode(mock(name), code)
  })

  it("names the file and line of a route it cannot resolve", async () => {
    await expect(parseApp(mock("unresolved"))).rejects.toThrow(/route "\/x" in src\/App\.jsx:7: .*"Missing"/)
  })

  it("names the file of a syntax error", async () => {
    await expect(parseApp(mock("broken"))).rejects.toThrow(/cannot parse src\/App\.jsx:\d+/)
  })

  it("explains why Next.js is rejected", async () => {
    await expect(parseApp(mock("next-app"))).rejects.toThrow(/Next\.js is not supported/)
  })
})
