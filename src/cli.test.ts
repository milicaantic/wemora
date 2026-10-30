import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { main, parseCliArgs, UsageError } from "./cli"
import { DEFAULTS } from "./core/config"

afterEach(() => vi.restoreAllMocks())

describe("parseCliArgs", () => {
  it("fills migrate defaults from core/config", () => {
    expect(parseCliArgs(["migrate", "examples/todomvc"])).toEqual({
      cmd: "migrate",
      webDir: "examples/todomvc",
      out: "output",
      maxBuilders: DEFAULTS.maxBuilders,
      maxTesters: DEFAULTS.maxTesters,
      budget: DEFAULTS.budgetUsd,
      mock: false,
      mockDir: undefined,
      originalUrl: undefined,
    })
  })

  it("takes the original app address for the tester", () => {
    expect(parseCliArgs(["migrate", "examples/todomvc", "--original-url", "http://localhost:7002"])).toMatchObject({
      originalUrl: "http://localhost:7002",
    })
  })

  it("reads every migrate flag, in any position", () => {
    expect(parseCliArgs(["migrate", "--mock", "--budget", "0.5", "app", "--max-builders", "2", "--mock-dir", "m", "--out", "o"])).toMatchObject({
      webDir: "app",
      mock: true,
      budget: 0.5,
      maxBuilders: 2,
      mockDir: "m",
      out: "o",
    })
  })

  it.each([
    [["migrate", "app", "--budget", "abc"], "--budget must be a positive number"],
    [["migrate", "app", "--max-builders", "0"], "--max-builders must be a whole number"],
    [["migrate"], "migrate needs exactly one <web-dir>"],
    [["deploy"], 'unknown command "deploy"'],
    [["migrate", "app", "--fast"], "Unknown option '--fast'"],
    [["verify", "run", "--mock"], "--mock only works with migrate"],
    [["migrate", "app", "--original-url", "localhost:7002"], "--original-url must be an http(s) address"],
    [["verify", "run", "--original-url", "http://x"], "--original-url only works with migrate"],
    [["sabotage", "run"], "sabotage needs <run-dir> and <unitId>"],
  ])("rejects %j", (argv, message) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError)
    expect(() => parseCliArgs(argv)).toThrow(message)
  })

  it("parses verify and sabotage", () => {
    expect(parseCliArgs(["verify", "runs/x"])).toEqual({ cmd: "verify", runDir: "runs/x" })
    expect(parseCliArgs(["sabotage", "runs/x", "recipe-list"])).toEqual({ cmd: "sabotage", runDir: "runs/x", unitId: "recipe-list" })
  })
})

describe("main", () => {
  it("prints usage and exits with 2 without arguments, and with 0 for --help", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {})
    expect(await main([])).toBe(2)
    expect(await main(["--help"])).toBe(0)
    expect(String(out.mock.calls[0][0])).toContain("wemora migrate <web-dir>")
  })

  it("exits with 2 and explains a usage error", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await main(["migrate", "app", "--budget", "0"])).toBe(2)
    expect(String(err.mock.calls[0][0])).toContain("--budget must be a positive number")
  })

  it("says verify and sabotage are not implemented yet", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await main(["verify", "runs/x"])).toBe(1)
    expect(String(err.mock.calls[0][0])).toContain("not implemented yet (A18")
  })

  it("does not import Mozaik, the orchestration or the runtime at load time", () => {
    const staticImports = readFileSync(new URL("./cli.ts", import.meta.url), "utf8").match(/^import .+$/gm) ?? []
    expect(staticImports.filter((line) => /@mozaik-ai|orchestration|core\/runtime/.test(line))).toEqual([])
  })
})
