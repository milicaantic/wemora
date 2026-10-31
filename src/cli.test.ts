import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { archiveName, main, parseCliArgs, UsageError } from "./cli"
import { DEFAULTS } from "./core/config"

// B's verify and sabotage run a real Expo export; here only the CLI around them is tested.
vi.mock("./verify", () => ({
  verifyDetailed: async (runDir: string) => {
    if (runDir === "runs/missing") throw new Error(`no results/ in "${runDir}"`)
    return { runDir, ok: runDir !== "runs/broken", units: [] }
  },
  formatVerifyReport: (details: { runDir: string; ok: boolean }) => `verify ${details.runDir}: ${details.ok ? "OK" : "FAILED"}`,
  sabotageDetailed: async (_runDir: string, unitId: string) => {
    if (unitId === "layout") throw new Error(`"${unitId}" is a shared unit`)
    return { unitId, file: "app/src/screens/todo-list/index.tsx", target: "New Todo Input", kind: "label" }
  },
}))

// D's archiveRun copies a whole run; here only the CLI around it is tested.
vi.mock("./report", () => ({
  archiveRun: async (_runDir: string, runsDir: string, name: string) => {
    if (name === "taken") throw new Error("runs/taken already exists; pick another name or delete it first")
    return `${process.cwd()}/${runsDir}/${name}`
  },
}))

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
    [["archive"], "archive needs exactly one <run-dir>"],
    [["verify", "run", "--name", "x"], "--name only works with archive"],
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

  it("prints the verify matrix and exits with 0 when every counted screen still passes (A18)", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {})
    expect(await main(["verify", "runs/good"])).toBe(0)
    expect(String(out.mock.calls[0][0])).toBe("verify runs/good: OK")
  })

  it("exits with 1 when verify fails or cannot run", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await main(["verify", "runs/broken"])).toBe(1)
    expect(await main(["verify", "runs/missing"])).toBe(1)
    expect(String(err.mock.calls[0][0])).toBe('wemora verify: no results/ in "runs/missing"')
  })

  it("says what sabotage changed, and exits with 1 and the reason when it cannot", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {})
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await main(["sabotage", "runs/copy", "todo-list"])).toBe(0)
    expect(String(out.mock.calls[0][0])).toBe(
      'sabotaged todo-list: "New Todo Input" (label) in app/src/screens/todo-list/index.tsx; now run verify on this folder',
    )
    expect(await main(["sabotage", "runs/copy", "layout"])).toBe(1)
    expect(String(err.mock.calls[0][0])).toBe('wemora sabotage: "layout" is a shared unit')
  })

  it("archives a run into runs/, named from its run-id unless --name is given (D18)", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {})
    expect(parseCliArgs(["archive", "output/20261031-152346-todomvc"])).toEqual({ cmd: "archive", runDir: "output/20261031-152346-todomvc" })
    expect(parseCliArgs(["archive", "o/x", "--name", "todomvc-real"])).toEqual({ cmd: "archive", runDir: "o/x", name: "todomvc-real" })

    expect(await main(["archive", "output/20261031-152346-todomvc"])).toBe(0)
    expect(String(out.mock.calls[0][0])).toMatch(/^archived output\/20261031-152346-todomvc into runs.todomvc-20261031-1523; check it with: npm run verify -- runs.todomvc-20261031-1523$/)
  })

  it("names an archive <app>-<yyyymmdd>-<hhmm>, and asks for --name when the folder is not a run-id", async () => {
    expect(archiveName("output/20261031-152346-todomvc")).toBe("todomvc-20261031-1523")
    expect(archiveName(path.join("some", "dir", "20261101-090000-recepti"))).toBe("recepti-20261101-0900")
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await main(["archive", "output/my-run"])).toBe(1)
    expect(String(err.mock.calls[0][0])).toBe('wemora archive: cannot make an archive name from "my-run"; pass --name <name>')
    expect(await main(["archive", "output/x", "--name", "taken"])).toBe(1)
  })

  it("does not import Mozaik, the orchestration or the runtime at load time", () => {
    const staticImports = readFileSync(new URL("./cli.ts", import.meta.url), "utf8").match(/^import .+$/gm) ?? []
    expect(staticImports.filter((line) => /@mozaik-ai|orchestration|core\/runtime/.test(line))).toEqual([])
  })
})
