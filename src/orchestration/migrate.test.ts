import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it, vi } from "vitest"
import { runMigrate, type MigrateOptions } from "./migrate"

// One real `migrate --mock` over examples/todomvc: D's parser and analyzer, the real report, no API calls.
// The architect is not merged yet, so the run stops there with a clear error and still writes the report.

const root = mkdtempSync(path.join(tmpdir(), "migrate-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const options = (extra: Partial<MigrateOptions> = {}): MigrateOptions => ({
  webDir: "examples/todomvc",
  out: path.join(root, "output"),
  maxBuilders: 4,
  maxTesters: 2,
  budget: 3,
  mock: true,
  ...extra,
})

describe("runMigrate", () => {
  it("refuses a real run without ANTHROPIC_API_KEY, before touching anything", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await runMigrate(options({ mock: false }), {})).toBe(2)
    expect(existsSync(path.join(root, "output"))).toBe(false)
  })

  it("refuses a missing web folder and a missing mock folder", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await runMigrate(options({ webDir: path.join(root, "nope") }))).toBe(2)
    expect(await runMigrate(options({ mockDir: path.join(root, "no-mocks") }))).toBe(2)
    expect(String(err.mock.calls[1][0])).toContain("no mock replies in")
  })

  it("runs the Conductor on TodoMVC with MockRunner and writes run.jsonl, analysis and the report", async () => {
    const mockDir = path.join(root, "mocks")
    mkdirSync(mockDir)
    const out = vi.spyOn(console, "log").mockImplementation(() => {})

    const code = await runMigrate(options({ mockDir }), {}, new Date(2026, 9, 30, 21, 45, 1))

    const runDir = path.join(root, "output", "20261030-214501-todomvc")
    expect(code).toBe(1)
    expect(readdirSync(runDir).sort()).toEqual(["analysis", "report.html", "run.jsonl"])
    expect(readdirSync(path.join(runDir, "analysis"))).toEqual(["part-1.json"])
    const events = readFileSync(path.join(runDir, "run.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { agent: string; event: string; data?: { outcome?: string; error?: string } })
    expect(events.find((e) => e.event === "analysis.done")?.agent).toBe("analyzer-1")
    expect(events.find((e) => e.event === "run.finished")?.data).toMatchObject({
      outcome: "error",
      error: expect.stringContaining("the architect agent is not available yet (D, D14)"),
    })
    expect(events.filter((e) => e.event === "participant.left").map((e) => e.agent)).toContain("analyzer-1")
    expect(String(out.mock.calls[0][0])).toContain("outcome: error")
  })
})
