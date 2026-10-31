import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { parseApp, splitParts } from "../analysis"
import type { RunConfig } from "../contracts"
import { initLog, log } from "../core/log"
import { BudgetedRunner, loadMockFixtureDir, MockRunner, type UsageRecord } from "../core/runner"
import { board, initializeRuntime } from "../core/runtime"
import { installSafety } from "../core/safety"
import { createInitialState } from "../core/state"
import { buildReport } from "../report"
import { scaffold } from "../scaffold"
import { serveOriginal } from "../scenarios"
import { createAgentFactories } from "./agents"
import { Conductor, type RunSummary } from "./conductor"

// `wemora migrate`: sets up output/<run-id>/, the log, the runtime with the right runner, and runs the
// Conductor. Returns the exit code: 0 when every unit reached a final status, 1 otherwise, 2 for bad input.

export type MigrateOptions = {
  webDir: string
  out: string
  maxBuilders: number
  maxTesters: number
  budget: number
  mock: boolean
  /** Folder with MockRunner replies; default src/agents/mocks/<web folder name>/ (D-013). */
  mockDir?: string
  /** The running original web app for the tester (Q8). Without it, B's serveOriginal builds and serves webDir (PD5). */
  originalUrl?: string
}

/** Replaceable so tests do not build the original web app. */
export type MigrateServices = { serveOriginal: typeof serveOriginal }

export async function runMigrate(
  options: MigrateOptions,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  services: MigrateServices = { serveOriginal },
): Promise<number> {
  const webDir = path.resolve(options.webDir)
  const appName = path.basename(webDir)
  if (!existsSync(webDir)) return fail(`web app folder not found: ${webDir}`)
  if (!options.mock && !env.ANTHROPIC_API_KEY) return fail("ANTHROPIC_API_KEY is not set; put it in .env or run with --mock")

  const mockDir = path.resolve(options.mockDir ?? path.join("src", "agents", "mocks", appName))
  if (options.mock && !existsSync(mockDir)) {
    return fail(`no mock replies in ${mockDir}; each agent owner adds <agent>.json there (D-013), or pass --mock-dir`)
  }

  // Before any agent starts: a web app that cannot be built stops the run here, with no run folder.
  let original: { url: string; close(): Promise<void> } | null = null
  if (!options.originalUrl) {
    console.log(`building and serving the original web app from ${webDir} (pass --original-url to use a running one)`)
    try {
      original = await services.serveOriginal(webDir)
    } catch (error) {
      console.error(`wemora migrate: the original web app could not be served: ${error instanceof Error ? error.message : String(error)}`)
      return 1
    }
  }
  const originalUrl = options.originalUrl ?? original!.url
  try {
    return await runWith(options, { webDir, appName, mockDir, originalUrl, servedOriginal: original !== null }, now)
  } finally {
    await original?.close().catch(() => {})
  }
}

async function runWith(
  options: MigrateOptions,
  run: { webDir: string; appName: string; mockDir: string; originalUrl: string; servedOriginal: boolean },
  now: Date,
): Promise<number> {
  const { webDir, appName, mockDir, originalUrl } = run
  const runId = `${stamp(now)}-${appName}`
  const runDir = path.resolve(options.out, runId)
  mkdirSync(runDir, { recursive: true })
  installSafety()
  initLog(runDir)

  const config: RunConfig = {
    webDir,
    runDir,
    maxBuilders: options.maxBuilders,
    maxTesters: options.maxTesters,
    budgetUsd: options.budget,
    mock: options.mock,
  }
  let conductor: Conductor | null = null
  const budgeted = options.mock
    ? null
    : new BudgetedRunner({
        budgetUsd: options.budget,
        onBudgetExceeded: () => conductor?.notifyBudgetExceeded(),
        onRateLimited: () => conductor?.notifyRateLimited(),
        onUsage: recordUsage,
      })
  const runner = budgeted ?? new MockRunner(loadMockFixtureDir(mockDir))

  initializeRuntime({ state: createInitialState(runId, config), inferenceRunnerConfig: { runner } })
  log({
    agent: "cli",
    event: "migrate.started",
    data: { runId, webDir, mock: options.mock, mockDir: options.mock ? mockDir : undefined, originalUrl, servedOriginal: run.servedOriginal },
  })

  const agents = createAgentFactories({ originalUrl })
  // The team follows the §9 formulas, up to --max-builders and --max-testers from the board's config (A14).
  conductor = new Conductor({ parseApp, splitParts, scaffold, buildReport, agents: agents.factories })
  const summary = await conductor.run()
  try {
    await agents.close()
  } catch (error) {
    log({ agent: "cli", event: "agents.close_failed", data: { error: error instanceof Error ? error.message : String(error) } })
  }
  printSummary(summary, budgeted?.spentUsd() ?? 0)
  return summary.outcome === "finished" ? 0 : 1
}

// The ledger on the board and a cost line in run.jsonl for the report (cost per agent).
function recordUsage(usage: UsageRecord): void {
  const agentId = usage.agentId ?? "unknown"
  const entry = (board().ledger[agentId] ??= { agentId, calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 })
  entry.calls++
  entry.inputTokens += usage.inputTokens
  entry.outputTokens += usage.outputTokens
  entry.usd += usage.usd
  log({
    agent: agentId,
    event: "model.usage",
    costUsd: usage.usd,
    data: {
      model: usage.model,
      inputTokens: usage.inputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      outputTokens: usage.outputTokens,
    },
  })
}

function printSummary(summary: RunSummary, spentUsd: number): void {
  const lines = [
    `run:     ${summary.runDir}`,
    `outcome: ${summary.outcome}${summary.error ? ` (${summary.error})` : ""}`,
    ...Object.entries(summary.units).map(([unitId, status]) => `  ${unitId}: ${status}${summary.statuses[unitId] ? ` / ${summary.statuses[unitId]}` : ""}`),
    `report:  ${summary.reportPath ?? "not built"}`,
    `cost:    $${spentUsd.toFixed(4)}`,
    `log:     ${path.join(summary.runDir, "run.jsonl")}`,
  ]
  console.log(lines.join("\n"))
}

function fail(message: string): number {
  console.error(`wemora migrate: ${message}`)
  return 2
}

// 20261030-214501: sorts by time and is safe as a folder name on every OS.
function stamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`
}
