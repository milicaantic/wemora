import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it, vi } from "vitest"
import { runMigrate, type MigrateOptions, type MigrateServices } from "./migrate"

// One real `migrate --mock` over examples/todomvc: D's parser, analyzer and architect, the real report,
// no API calls. With no mock replies the architect gives up and sends plan.failed (D-012), so the run
// ends there and still writes the report.

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

// B's serveOriginal runs `npm run build` in the web app; here it only hands out an address.
function fakeOriginal(fail?: string) {
  const close = vi.fn(async () => {})
  const serveOriginal = vi.fn(async () => {
    if (fail) throw new Error(fail)
    return { url: "http://127.0.0.1:7999", close }
  })
  return { services: { serveOriginal } as unknown as MigrateServices, serveOriginal, close }
}

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

    const original = fakeOriginal()

    const code = await runMigrate(options({ mockDir }), {}, new Date(2026, 9, 30, 21, 45, 1), original.services)

    const runDir = path.join(root, "output", "20261030-214501-todomvc")
    expect(code).toBe(1)
    expect(readdirSync(runDir).sort()).toEqual(["analysis", "plan.errors.json", "report.html", "run.jsonl"])
    expect(readdirSync(path.join(runDir, "analysis"))).toEqual(["part-1.json"])
    const events = readFileSync(path.join(runDir, "run.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { agent: string; event: string; data?: { outcome?: string; error?: string } })
    expect(events.find((e) => e.event === "analysis.done")?.agent).toBe("analyzer-1")
    expect(events.find((e) => e.event === "plan.failed")?.agent).toBe("architect-1")
    expect(events.find((e) => e.event === "run.finished")?.data).toMatchObject({ outcome: "plan.failed" })
    expect(events.filter((e) => e.event === "participant.left").map((e) => e.agent)).toEqual(
      expect.arrayContaining(["analyzer-1", "architect-1"]),
    )
    expect(out.mock.calls.map((c) => String(c[0])).join("\n")).toContain("outcome: plan.failed")
    // Without --original-url the original was built and served for the run, then stopped (PD5).
    expect(original.serveOriginal).toHaveBeenCalledWith(path.resolve("examples/todomvc"))
    expect(events.find((e) => e.event === "migrate.started")?.data).toMatchObject({ originalUrl: "http://127.0.0.1:7999", servedOriginal: true })
    expect(original.close).toHaveBeenCalledTimes(1)
  })

  it("stops with exit 1 and no run folder when the original web app cannot be served", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
    const out = path.join(root, "unserved")
    const original = fakeOriginal("examples/todomvc has dependencies but no node_modules: run npm ci there")

    expect(await runMigrate(options({ out }), {}, new Date(), original.services)).toBe(1)
    expect(existsSync(out)).toBe(false)
    expect(String(err.mock.calls.at(-1)?.[0])).toBe(
      "wemora migrate: the original web app could not be served: examples/todomvc has dependencies but no node_modules: run npm ci there",
    )
  })
})
