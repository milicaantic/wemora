import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  analyzerOutputSchema,
  ArchitectOutputSchema,
  createFileAccess,
  finalizeReports,
  normalizePlan,
  parseApp,
  splitParts,
  validatePlan,
} from "../../analysis"
import { PlanSchema, type ParsedApp } from "../../contracts"
import { loadMockFixture, loadMockFixtureDir, type MockReply } from "../../core/runner"

// D's MockRunner replies (D-013): src/agents/mocks/<app>/analyzer.json and architect.json.
// They must work with the real parser and the real checks, as if a model had written them.

const apps = [
  { name: "todomvc", webDir: "examples/todomvc" },
  { name: "recepti", webDir: "examples/recepti" },
] as const

const fixtureFile = (app: string, agent: string) => `src/agents/mocks/${app}/${agent}.json`
const jsonOf = (replies: MockReply[]) => {
  const last = replies.at(-1)
  if (!last || !("json" in last)) throw new Error("the last reply must be JSON")
  return last.json
}

// The CLI uses one analyzer in F2 (FIXED_TEAM), so the parser's single part is "part-1".
async function parsedApp(webDir: string): Promise<ParsedApp> {
  const app = await parseApp(webDir)
  return { ...app, parts: splitParts(app, 1) }
}

describe.each(apps)("mock replies for $name", ({ name, webDir }) => {
  it("pass MockFixtureSchema and load together with the other owners' files", () => {
    expect(Object.keys(loadMockFixture(fixtureFile(name, "analyzer")))).toEqual(["analyzer:part-1"])
    expect(Object.keys(loadMockFixture(fixtureFile(name, "architect")))).toEqual(["architect"])
    const merged = loadMockFixtureDir(`src/agents/mocks/${name}`)
    expect(merged).toHaveProperty(["analyzer:part-1"])
    expect(merged).toHaveProperty(["architect"])
  })

  it("analyzer: every tool call is allowed and the report passes the analyzer's own checks", async () => {
    const parsed = await parsedApp(webDir)
    const replies = loadMockFixture(fixtureFile(name, "analyzer"))["analyzer:part-1"]!
    const files = createFileAccess(parsed, "part-1")

    for (const reply of replies.slice(0, -1)) {
      expect(reply).toHaveProperty("call")
      if (!("call" in reply)) continue
      expect(["list_files", "read_file"]).toContain(reply.call.name)
      if (reply.call.name === "read_file") expect(() => files.read(String(reply.call.args.path))).not.toThrow()
    }

    const output = jsonOf(replies)
    expect(analyzerOutputSchema(parsed, "part-1").safeParse(output).success).toBe(true)
    const final = finalizeReports(output, parsed, "part-1")
    expect(final.ok).toBe(true)
    if (final.ok) expect(final.reports.map((r) => r.route).sort()).toEqual(parsed.routes.map((r) => r.path).sort())
  })

  it("architect: the plan passes the model schema, and after normalizePlan also validatePlan", async () => {
    const parsed = await parsedApp(webDir)
    const output = ArchitectOutputSchema.parse(jsonOf(loadMockFixture(fixtureFile(name, "architect"))["architect"]!))
    const plan = normalizePlan(output, parsed)
    expect(PlanSchema.safeParse(plan).success).toBe(true)
    expect(validatePlan(plan, parsed)).toEqual([])
    for (const unit of plan.units.filter((u) => u.kind === "screen")) expect(unit.obligations.length).toBeGreaterThanOrEqual(1)
  })
})

describe("mock plan for TodoMVC can be proven", () => {
  // What scenarios/extractInteractive finds on the original at "/" (checked 2026-10-31 over examples/todomvc).
  // A screen is proven only when each of these is used by a test or marked notPortable.
  const originalElements = [
    { role: "textbox", name: "New Todo Input" },
    { role: "link", name: "TodoMVC" },
  ]

  it("every interactive element of the original is in an obligation or marked notPortable", () => {
    const output = ArchitectOutputSchema.parse(jsonOf(loadMockFixture(fixtureFile("todomvc", "architect"))["architect"]!))
    const screen = output.units.find((u) => u.id === "todo-list")!
    const notPortable = screen.intentionalDifferences.flatMap((d) => (d.kind === "notPortable" ? [d.element.name] : []))
    const described = screen.obligations.map((o) => o.description).join("\n")
    for (const element of originalElements) {
      const handled = notPortable.includes(element.name) || described.includes(`'${element.name}'`)
      expect(handled, `${element.role} "${element.name}"`).toBe(true)
    }
  })

  it("obligations use the named '❯ Toggle All Input', not the unnamed checkbox of one todo", () => {
    const output = ArchitectOutputSchema.parse(jsonOf(loadMockFixture(fixtureFile("todomvc", "architect"))["architect"]!))
    const screen = output.units.find((u) => u.id === "todo-list")!
    for (const id of ["complete-todo", "filter-todos", "clear-completed"]) {
      expect(screen.obligations.find((o) => o.id === id)?.description).toContain("'❯ Toggle All Input'")
    }
  })

  it("says that the filters in the address (#/active) are state of the screen on the phone", () => {
    const output = ArchitectOutputSchema.parse(jsonOf(loadMockFixture(fixtureFile("todomvc", "architect"))["architect"]!))
    const filter = output.units.find((u) => u.id === "todo-list")!.obligations.find((o) => o.id === "filter-todos")!
    expect(filter.description).toContain("#/active")
    expect(filter.description).toContain("state of this screen")
  })
})

describe("mock plan for Recepti", () => {
  it("is the hand-written plan once the code fills in size, writes and routeMap", async () => {
    const parsed = await parsedApp("examples/recepti")
    const output = ArchitectOutputSchema.parse(jsonOf(loadMockFixture(fixtureFile("recepti", "architect"))["architect"]!))
    const manual = PlanSchema.parse(JSON.parse(readFileSync("examples/recepti/wemora/plan.manual.json", "utf8")))
    expect(normalizePlan(output, parsed)).toEqual(normalizePlan(manual, parsed))
  })
})
