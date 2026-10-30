import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { AnalysisPartSchema, type AnalysisPart, type ParsedApp, type ParsedRoute } from "../contracts"
import { parseApp, splitParts } from "./index"

const recepti = await parseApp(fileURLToPath(new URL("../../examples/recepti", import.meta.url)))

const r = (path: string, tokens: number, files: string[] = [`src/${path.replace(/\W/g, "") || "root"}.jsx`]): ParsedRoute => ({
  path,
  file: files[0] ?? "src/x.jsx",
  files,
  tokens,
  webApis: [],
})
const app = (routes: ParsedRoute[]): ParsedApp => ({ webDir: "/app", routes, sharedFiles: ["src/main.jsx"], totalTokens: 0, parts: [] })

/** Every route of `parsed` is in exactly one part. */
const expectEachRouteOnce = (parsed: ParsedApp, parts: AnalysisPart[]) => {
  const all = parts.flatMap((p) => p.routes)
  expect([...all].sort()).toEqual(parsed.routes.map((x) => x.path).sort())
}

describe("splitParts on examples/recepti", () => {
  it("n = 1 gives one part with all 5 routes and their files", () => {
    const parts = splitParts(recepti, 1)
    expect(parts).toHaveLength(1)
    expect(parts[0]!.routes).toHaveLength(5)
    expect(parts[0]!.files).toHaveLength(10)
    expect(parts[0]!.tokens).toBe(recepti.routes.reduce((sum, x) => sum + x.tokens, 0))
  })

  it("n = 2 gives two parts that are close in size", () => {
    const parts = splitParts(recepti, 2)
    expect(parts.map((p) => p.id)).toEqual(["part-1", "part-2"])
    expectEachRouteOnce(recepti, parts)
    const largestRoute = Math.max(...recepti.routes.map((x) => x.tokens))
    expect(Math.abs(parts[0]!.tokens - parts[1]!.tokens)).toBeLessThanOrEqual(largestRoute)
  })

  it("never makes empty parts: n = 10 gives 5, n = 0 gives 1", () => {
    expect(splitParts(recepti, 10)).toHaveLength(5)
    expect(splitParts(recepti, 0)).toHaveLength(1)
    expect(splitParts(recepti, 10).every((p) => p.routes.length === 1)).toBe(true)
  })

  it("parts pass the contract schema and keep shared files out", () => {
    for (const part of splitParts(recepti, 3)) {
      expect(AnalysisPartSchema.safeParse(part).success).toBe(true)
      for (const shared of recepti.sharedFiles) expect(part.files).not.toContain(shared)
    }
  })

  it("parseApp's own parts are splitParts(parsed, 1)", () => {
    expect(recepti.parts).toEqual(splitParts(recepti, 1))
  })

  it("is deterministic", () => {
    expect(JSON.stringify(splitParts(recepti, 3))).toBe(JSON.stringify(splitParts(recepti, 3)))
  })
})

describe("splitParts rules", () => {
  it("puts the largest route first, each into the lightest part", () => {
    // 50 → p1, 40 → p2, 30 → p2 (40 < 50), 20 → p1 (50 < 70), 10 → p1 (70 = 70, lower index wins)
    const parts = splitParts(app([r("/a", 10), r("/b", 20), r("/c", 30), r("/d", 40), r("/e", 50)]), 2)
    expect(parts).toEqual([
      { id: "part-1", routes: ["/a", "/b", "/e"], files: ["src/a.jsx", "src/b.jsx", "src/e.jsx"], tokens: 80 },
      { id: "part-2", routes: ["/c", "/d"], files: ["src/c.jsx", "src/d.jsx"], tokens: 70 },
    ])
  })

  it("breaks ties between equal routes by path", () => {
    const parts = splitParts(app([r("/z", 10), r("/a", 10)]), 2)
    expect(parts.map((p) => p.routes)).toEqual([["/a"], ["/z"]])
  })

  it("lists a file used by two routes of the same part once", () => {
    const parts = splitParts(app([r("/a", 5, ["src/a.jsx", "src/x.css"]), r("/b", 5, ["src/b.jsx", "src/x.css"])]), 1)
    expect(parts[0]!.files).toEqual(["src/a.jsx", "src/b.jsx", "src/x.css"])
  })

  it("treats a fractional or invalid n safely", () => {
    const parsed = app([r("/a", 1), r("/b", 2), r("/c", 3)])
    expect(splitParts(parsed, 2.9)).toHaveLength(2)
    expect(splitParts(parsed, Number.NaN)).toHaveLength(1)
    expect(splitParts(parsed, -3)).toHaveLength(1)
  })

  it("returns no parts for an app without routes", () => {
    expect(splitParts(app([]), 3)).toEqual([])
  })
})
