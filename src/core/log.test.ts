import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { initLog, log } from "./log"
import { handleUnhandledRejection, installSafety } from "./safety"

const dirs: string[] = []

function newRunDir(): string {
  const root = mkdtempSync(path.join(tmpdir(), "log-"))
  dirs.push(root)
  return path.join(root, "output", "run-1")
}

const readLines = (runDir: string) =>
  readFileSync(path.join(runDir, "run.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))

afterEach(() => {
  process.removeListener("unhandledRejection", handleUnhandledRejection)
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe("log", () => {
  it("appends one JSON line per entry, in order, creating the run folder", () => {
    const runDir = newRunDir()
    initLog(runDir)

    log({ agent: "conductor", event: "plan.ready" })
    log({ agent: "builder-1", event: "inference.completed", costUsd: 0.002, data: { unitId: "u1" } })

    const lines = readLines(runDir)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ agent: "conductor", event: "plan.ready" })
    expect(lines[1]).toMatchObject({ agent: "builder-1", costUsd: 0.002, data: { unitId: "u1" } })
    for (const line of lines) expect(new Date(line.t).toISOString()).toBe(line.t)
  })

  it("does not throw on data that cannot be serialized", () => {
    const runDir = newRunDir()
    initLog(runDir)
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => log({ agent: "x", event: "circular", data: circular })).not.toThrow()
    expect(readLines(runDir)[0]).toMatchObject({ event: "circular", data: "[unserializable]" })
  })

  it("writes to stderr instead of throwing when called before initLog", async () => {
    vi.resetModules()
    const fresh = await import("./log")
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    expect(() => fresh.log({ agent: "x", event: "early" })).not.toThrow()
    expect(String(stderr.mock.calls[0][0])).toContain("[log before initLog]")
  })
})

describe("safety", () => {
  it("logs an unhandled rejection instead of crashing", () => {
    const runDir = newRunDir()
    initLog(runDir)
    vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    handleUnhandledRejection(new Error("429 from API"))
    handleUnhandledRejection("plain reason")

    const [first, second] = readLines(runDir)
    expect(first).toMatchObject({ agent: "process", event: "unhandledRejection", data: { message: "429 from API" } })
    expect(first.data.stack).toContain("429 from API")
    expect(second.data).toEqual({ message: "plain reason" })
  })

  it("registers the handler exactly once", () => {
    installSafety()
    installSafety()
    const ours = process.listeners("unhandledRejection").filter((l) => l === handleUnhandledRejection)
    expect(ours).toHaveLength(1)
  })
})
