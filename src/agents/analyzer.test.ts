import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createHuman,
  FunctionCallOutputItem,
  SituationSpecification,
  type InferenceInput,
  type InferenceOutput,
  type SituationContext,
} from "@mozaik-ai/core"
import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { parseApp } from "../analysis"
import { AnalyzerReportSchema, type ParsedApp, type RunConfig } from "../contracts"
import { initLog } from "../core/log"
import { MockRunner, type MockFixture } from "../core/runner"
import { board, initializeRuntime, join } from "../core/runtime"
import { createInitialState } from "../core/state"
import { createAnalyzer } from "./analyzer"

// All tests that need the runtime live in this file: Mozaik allows one runtime per process.

const goodReport = {
  route: "*",
  screen: "Todo list",
  summary: "One screen with the todo list: add, complete, edit and filter todos.",
  files: ["src/todo/app.jsx", "./src/todo/components/item.jsx", "../outside.js"],
  components: ["App", "Header", "Main", "Footer", "Item"],
  dataSources: ["local state via useReducer in src/todo/reducer.js"],
  navigatesTo: ["/active", "/completed"],
  webApis: ["keyboard"],
  mobileIssues: ["editing starts on double click; phones have no double click"],
  suggestedObligations: ["typing 'Buy milk' in 'What needs to be done?' and pressing Enter adds 'Buy milk' to the list"],
}

const fixture: MockFixture = {
  "analyzer:part-1": [
    { call: { name: "list_files", args: {} } },
    { call: { name: "read_file", args: { path: "src/todo/app.jsx" } } },
    { json: { reports: [goodReport] } },
  ],
  "analyzer:part-bad": [
    { text: "not json" },
    { json: { reports: [] } },
    { json: { reports: [{ ...goodReport, route: "/nope" }] } },
  ],
  "analyzer:part-escape": [
    { call: { name: "read_file", args: { path: "../package.json" } } },
    { call: { name: "read_file", args: { path: "C:\\Windows\\win.ini" } } },
    { json: { reports: [goodReport] } },
  ],
  "analyzer:part-busy": [{ call: { name: "list_files", args: {} } }, { json: { reports: [goodReport] } }],
  "analyzer:part-cancel": [
    { call: { name: "list_files", args: {} } },
    { call: { name: "list_files", args: {} } },
    { json: { reports: [goodReport] } },
  ],
}

// Keeps every tool output the model saw, so tests can check what came back from a tool.
class RecordingRunner extends MockRunner {
  toolOutputs: string[] = []
  override async run(input: InferenceInput): Promise<InferenceOutput> {
    for (const item of input.context.getItems()) {
      if (item instanceof FunctionCallOutputItem && !this.toolOutputs.includes(item.output.text)) this.toolOutputs.push(item.output.text)
    }
    return super.run(input)
  }
}

class AnalysisDone extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "analysis.done"
  }
}

const runner = new RecordingRunner(fixture)
const done: { partId: string; producerId: string }[] = []
const waiting = new Map<string, () => void>()
let runDir = ""
let parsed: ParsedApp

function waitForDone(partId: string): Promise<void> {
  if (done.some((d) => d.partId === partId)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no analysis.done for ${partId}`)), 5_000)
    waiting.set(partId, () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

let agentCount = 0
function newAnalyzer() {
  const analyzer = createAnalyzer(`analyzer-${++agentCount}`)
  join(analyzer.participant)
  return analyzer
}

const readReports = (partId: string) =>
  z.array(AnalyzerReportSchema).parse(JSON.parse(readFileSync(path.join(runDir, "analysis", `${partId}.json`), "utf8")))

beforeAll(async () => {
  runDir = mkdtempSync(path.join(tmpdir(), "wemora-analyzer-"))
  initLog(runDir)
  const app = await parseApp("examples/todomvc")
  // The same part under several IDs, so each test has its own scripted replies.
  const ids = ["part-1", "part-bad", "part-escape", "part-busy", "part-cancel"]
  parsed = { ...app, parts: ids.map((id) => ({ ...app.parts[0]!, id })) }

  const config: RunConfig = { webDir: "examples/todomvc", runDir, maxBuilders: 1, maxTesters: 1, budgetUsd: 0, mock: true }
  const state = createInitialState("analyzer-test", config)
  state.parsed = parsed
  initializeRuntime({ state, inferenceRunnerConfig: { runner } })

  const listener = createHuman({
    name: "listener",
    capabilities: [],
    handlers: [
      {
        specification: new AnalysisDone(),
        processor: {
          apply: ({ event }) => {
            const { partId } = event.payload as { partId: string }
            done.push({ partId, producerId: event.producerId })
            waiting.get(partId)?.()
          },
        },
      },
    ],
  })
  join(listener)
})

describe("analyzer agent", () => {
  it("reads files with its tools and writes a checked report to the board and to disk", async () => {
    const analyzer = newAnalyzer()
    analyzer.assign({ partId: "part-1" })
    expect(analyzer.isBusy()).toBe(true)
    await waitForDone("part-1")

    expect(analyzer.isBusy()).toBe(false)
    const reports = readReports("part-1")
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ partId: "part-1", route: "*", screen: "Todo list" })
    // finalizeReports keeps only allowed files and adds the parser's files and web APIs.
    expect(reports[0]!.files).toContain("src/todo/components/item.jsx")
    expect(reports[0]!.files).not.toContain("../outside.js")
    expect(reports[0]!.webApis).toEqual(["doubleclick", "keyboard"])
    expect(board().reports["part-1"]).toEqual(reports)

    expect(runner.toolOutputs.some((t) => t.split("\n").includes("src/index.js"))).toBe(true)
    expect(runner.toolOutputs.some((t) => t.includes("useReducer") || t.includes("export"))).toBe(true)
  })

  it("sends exactly one analysis.done with the part ID, from the agent itself", async () => {
    await waitForDone("part-1")
    const events = done.filter((d) => d.partId === "part-1")
    expect(events).toHaveLength(1)
    expect(events[0]!.producerId).not.toBe("analyzer-1")
  })

  it("falls back to parser-only reports after three invalid replies, and still sends analysis.done", async () => {
    const analyzer = newAnalyzer()
    analyzer.assign({ partId: "part-bad" })
    await waitForDone("part-bad")

    const reports = readReports("part-bad")
    expect(reports).toHaveLength(1)
    expect(reports[0]!.summary).toMatch(/^Automatic fallback/)
    expect(reports[0]!.route).toBe("*")
    const logLines = readFileSync(path.join(runDir, "run.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l))
    expect(logLines.some((l) => l.event === "analysis.fallback" && l.data.partId === "part-bad")).toBe(true)
  })

  it("returns a refused path to the model as an error and the loop goes on", async () => {
    const analyzer = newAnalyzer()
    analyzer.assign({ partId: "part-escape" })
    await waitForDone("part-escape")

    expect(runner.toolOutputs.some((t) => t.includes('File not allowed: "../package.json"'))).toBe(true)
    expect(runner.toolOutputs.some((t) => t.includes('File not allowed: "C:\\Windows\\win.ini"'))).toBe(true)
    expect(readReports("part-escape")[0]!.summary).not.toMatch(/^Automatic fallback/)
  })

  it("ignores a second task while busy", async () => {
    const analyzer = newAnalyzer()
    analyzer.assign({ partId: "part-busy" })
    analyzer.assign({ partId: "part-1" })
    await waitForDone("part-busy")
    await new Promise((r) => setTimeout(r, 50))

    expect(done.filter((d) => d.partId === "part-busy")).toHaveLength(1)
    expect(done.filter((d) => d.partId === "part-1")).toHaveLength(1)
  })

  it("on cancel ends the loop, writes fallback reports with the reason and sends analysis.done", async () => {
    const analyzer = newAnalyzer()
    analyzer.assign({ partId: "part-cancel" })
    analyzer.cancel("timeout")
    await waitForDone("part-cancel")

    expect(readReports("part-cancel")[0]!.summary).toContain("timeout")
    expect(analyzer.isBusy()).toBe(false)
  })

  it("for an unknown part still sends analysis.done, with no reports", async () => {
    const analyzer = newAnalyzer()
    analyzer.assign({ partId: "part-missing" })
    await waitForDone("part-missing")

    expect(readReports("part-missing")).toEqual([])
    expect(existsSync(path.join(runDir, "analysis", "part-missing.json"))).toBe(true)
  })
})
