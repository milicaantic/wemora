import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { AnalyzerReportSchema, type ParsedApp } from "../contracts"
import {
  MAX_FILE_CHARS,
  analyzerBrief,
  analyzerOutputSchema,
  createFileAccess,
  fallbackReports,
  finalizeReports,
  parseApp,
  splitParts,
  type ModelReport,
} from "./index"

const recepti = await parseApp(fileURLToPath(new URL("../../examples/recepti", import.meta.url)))
// Two parts, as the Conductor would make for a bigger app.
const split: ParsedApp = { ...recepti, parts: splitParts(recepti, 2) }
const part1 = split.parts[0]!
const part2 = split.parts[1]!
const otherPartFile = part2.files[0]!

const report = (route: string, extra: Partial<ModelReport> = {}): ModelReport => ({
  route,
  screen: "Screen",
  summary: "Shows things.",
  files: [],
  components: [],
  dataSources: [],
  navigatesTo: [],
  webApis: [],
  mobileIssues: [],
  suggestedObligations: [],
  ...extra,
})
const allReports = (parsed: ParsedApp, partId: string) => ({ reports: parsed.parts.find((p) => p.id === partId)!.routes.map((r) => report(r)) })

const temps: string[] = []
afterAll(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })))

describe("createFileAccess", () => {
  const access = createFileAccess(split, part1.id)

  it("lists the part's files and the shared files, not other parts' files", () => {
    const listed = access.list()
    for (const f of part1.files) expect(listed).toContain(f)
    for (const f of split.sharedFiles) expect(listed).toContain(f)
    for (const f of part2.files) expect(listed).not.toContain(f)
    expect(listed).toEqual([...listed].sort())
  })

  it("reads allowed files, also written as ./x or with Windows separators", () => {
    const own = part1.files.find((f) => f.endsWith(".tsx"))!
    expect(access.read(own)).toContain("export function")
    expect(access.read(`./${own}`)).toBe(access.read(own))
    expect(access.read(own.replaceAll("/", "\\"))).toBe(access.read(own))
    expect(access.read("src/api/client.ts")).toContain("API_URL")
  })

  it.each(["../package.json", "src/../../package.json", "/etc/passwd", "C:\\Windows\\win.ini", "package.json", "", otherPartFile])(
    "refuses %j with a message for the model",
    (requested) => {
      expect(() => access.read(requested)).toThrow(/File not allowed: .*call list_files/)
    },
  )

  it("rejects an unknown part", () => {
    expect(() => createFileAccess(split, "part-9")).toThrow(/unknown part "part-9"/)
  })

  it("truncates very long files and says so", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "wemora-access-"))
    temps.push(dir)
    writeFileSync(path.join(dir, "big.js"), "x".repeat(MAX_FILE_CHARS + 500))
    const parsed: ParsedApp = { webDir: dir, routes: [], sharedFiles: ["big.js"], totalTokens: 0, parts: [{ id: "part-1", routes: [], files: [], tokens: 0 }] }
    const text = createFileAccess(parsed, "part-1").read("big.js")
    expect(text.startsWith("x".repeat(MAX_FILE_CHARS))).toBe(true)
    expect(text).toContain(`truncated: the file has ${MAX_FILE_CHARS + 500} characters`)
  })
})

describe("analyzerBrief", () => {
  const brief = analyzerBrief(split, part1.id)

  it("names the part's routes, their files and web APIs, and the shared files", () => {
    for (const route of part1.routes) expect(brief).toContain(`route "${route}"`)
    for (const file of part1.files) expect(brief).toContain(`"${file}"`)
    expect(brief).toContain(`"src/api/client.ts"`)
    expect(brief).toContain(`exactly one report per route above (${part1.routes.length} in total)`)
  })

  it("leaves out the other part's routes", () => {
    for (const route of part2.routes) expect(brief).not.toContain(`route "${route}"`)
  })

  it("is the same every time", () => {
    expect(analyzerBrief(split, part1.id)).toBe(brief)
  })
})

describe("finalizeReports", () => {
  it("accepts one report per route, adds partId and the parser's files and web APIs", () => {
    const result = finalizeReports(
      { reports: [report("/", { files: ["src/pages/RecipeListPage.tsx", "src/api/client.ts", "src/nope.ts"], webApis: ["fetch"] }), ...allReports(recepti, "part-1").reports.slice(1)] },
      recepti,
      "part-1",
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.reports.map((r) => r.route)).toEqual(recepti.parts[0]!.routes)
    const list = result.reports.find((r) => r.route === "/")!
    expect(list.partId).toBe("part-1")
    expect(list.files).toEqual(["src/api/client.ts", "src/pages/RecipeListPage.css", "src/pages/RecipeListPage.tsx"])
    expect(list.webApis).toEqual(["fetch", "hover", "table"])
    for (const r of result.reports) expect(AnalyzerReportSchema.safeParse(r).success).toBe(true)
  })

  it("drops files the analyzer was not allowed to read", () => {
    const raw = allReports(split, part1.id)
    raw.reports[0] = report(raw.reports[0]!.route, { files: [otherPartFile] })
    const result = finalizeReports(raw, split, part1.id)
    expect(result.ok && result.reports[0]!.files).not.toContain(otherPartFile)
  })

  it("reports a missing route, a duplicate and a route from another part", () => {
    const routes = part1.routes
    const raw = { reports: [report(routes[0]!), report(routes[0]!), report(part2.routes[0]!)] }
    const result = finalizeReports(raw, split, part1.id)
    expect(result.ok).toBe(false)
    if (result.ok) return
    if (routes.length > 1) expect(result.error).toContain(`missing report for route "${routes[1]}"`)
    expect(result.error).toContain(`2 reports for route "${routes[0]}"`)
    expect(result.error).toContain(`report for route "${part2.routes[0]}" is not in your part`)
  })

  it("explains schema errors with the path, and rejects partId or unknown fields from the model", () => {
    const missing = finalizeReports({ reports: [{ route: "/" }] }, recepti, "part-1")
    expect(!missing.ok && missing.error).toMatch(/reports\.0\.screen/)
    const extra = finalizeReports({ reports: [{ ...report("/"), partId: "part-7" }] }, recepti, "part-1")
    expect(extra.ok).toBe(false)
    const notObject = finalizeReports("not json", recepti, "part-1")
    expect(notObject.ok).toBe(false)
  })

  it("the agent's schema still turns into JSON Schema for structured output", () => {
    const json = z.toJSONSchema(analyzerOutputSchema(recepti, "part-1")) as { properties: Record<string, unknown> }
    expect(Object.keys(json.properties)).toEqual(["reports"])
  })
})

describe("fallbackReports", () => {
  const reports = fallbackReports(recepti, "part-1", "3 invalid answers")

  it("gives one valid report per route, built from the parser", () => {
    expect(reports.map((r) => r.route)).toEqual(recepti.parts[0]!.routes)
    for (const r of reports) expect(AnalyzerReportSchema.safeParse(r).success).toBe(true)
    expect(reports.every((r) => r.summary.includes("3 invalid answers"))).toBe(true)
  })

  it("names the screen after its file and turns web APIs into mobile issues", () => {
    const list = reports.find((r) => r.route === "/")!
    expect(list.screen).toBe("RecipeListPage")
    expect(list.mobileIssues).toEqual([
      "shows content on mouse hover; touch screens have no hover",
      "uses an HTML table; a wide table does not fit a phone screen",
    ])
  })
})
