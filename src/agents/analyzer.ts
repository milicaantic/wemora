import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createAgent, type Tool } from "@mozaik-ai/core"
import { z } from "zod"
import {
  analyzerBrief,
  analyzerOutputSchema,
  createFileAccess,
  fallbackReports,
  finalizeReports,
  type FileAccess,
} from "../analysis"
import type { AnalyzerReport } from "../contracts"
import { MODELS } from "../core/config"
import { log } from "../core/log"
import { board, emit } from "../core/runtime"
import { CancelGuard, defineTool, runStructured, type AgentHandle, type AnalyzeTask } from "./_shared"

// Analyzer agent (architecture.md §4, step 3): reads one part of the web app and writes one
// AnalyzerReport per route. The rules (allowed files, brief, output checks, fallback) live in
// analysis/; this file only wires them to Mozaik.

export const ANALYZER_MAX_OUTPUT_TOKENS = 8000

const PROMPT_FILE = fileURLToPath(new URL("./prompts/analyzer.md", import.meta.url))
let prompt: string | null = null
const analyzerPrompt = () => (prompt ??= readFileSync(PROMPT_FILE, "utf8"))

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

// The tools read the FileAccess of the current task; between tasks there is none.
function analyzerTools(current: () => FileAccess | null): Tool[] {
  const access = () => {
    const files = current()
    if (!files) throw new Error("No analysis task is active.")
    return files
  }
  return [
    defineTool({
      name: "list_files",
      description: "List every file you may read: the files of your part and the shared files, one path per line.",
      args: z.strictObject({}),
      invoke: async () => access().list().join("\n"),
    }),
    defineTool({
      name: "read_file",
      description: "Read one file as text. Use a path exactly as list_files shows it, e.g. src/pages/RecipeListPage.tsx.",
      args: z.strictObject({ path: z.string() }),
      invoke: async ({ path: file }) => access().read(file),
    }),
  ]
}

export function createAnalyzer(id: string): AgentHandle<AnalyzeTask> {
  let access: FileAccess | null = null
  let busyWith: string | null = null
  let guard: CancelGuard | null = null

  const tools = analyzerTools(() => access)
  const agent = createAgent({
    name: id,
    capabilities: ["analyze"],
    instruction: "Analyzer of a React web app. Each task brings its own instructions.",
    tools,
    handlers: [],
  })

  // Asks the model; falls back to parser-only reports when it gives no valid output.
  async function produceReports(partId: string, cancel: CancelGuard): Promise<AnalyzerReport[]> {
    const parsed = board().parsed
    if (!parsed) throw new Error("the board has no parsed app (board().parsed is null)")
    access = createFileAccess(parsed, partId)
    try {
      const result = await runStructured(
        agent,
        {
          prompt: analyzerPrompt(),
          message: analyzerBrief(parsed, partId),
          meta: { agentId: id, kind: "analyzer", taskId: partId },
          model: MODELS.default,
          maxOutputTokens: ANALYZER_MAX_OUTPUT_TOKENS,
          tools,
          guard: cancel,
        },
        analyzerOutputSchema(parsed, partId),
      )
      let why: string
      if (result.ok) {
        const final = finalizeReports(result.value, parsed, partId)
        if (final.ok) return final.reports
        why = final.error
      } else {
        why = result.error
      }
      log({ agent: id, event: "analysis.fallback", data: { partId, reason: why } })
      return fallbackReports(parsed, partId, why)
    } finally {
      access = null
    }
  }

  // Last resort when even the setup failed (no parsed app, unknown part): the run must not hang.
  function emergencyReports(partId: string, error: unknown): AnalyzerReport[] {
    log({ agent: id, event: "analysis.failed", data: { partId, error: message(error) } })
    try {
      const parsed = board().parsed
      return parsed ? fallbackReports(parsed, partId, message(error)) : []
    } catch {
      return []
    }
  }

  function publish(partId: string, reports: AnalyzerReport[]): void {
    try {
      board().reports[partId] = reports
      const dir = path.join(board().config.runDir, "analysis")
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, `${partId}.json`), `${JSON.stringify(reports, null, 2)}\n`)
    } catch (error) {
      log({ agent: id, event: "analysis.write_failed", data: { partId, error: message(error) } })
    }
    // Free before emitting: the Conductor may hand out the next task from its analysis.done handler.
    busyWith = null
    guard = null
    try {
      emit("analysis.done", { partId }, agent.getId())
    } catch (error) {
      log({ agent: id, event: "analysis.emit_failed", data: { partId, error: message(error) } })
    }
  }

  async function analyze(partId: string, cancel: CancelGuard): Promise<void> {
    let reports: AnalyzerReport[]
    try {
      reports = await produceReports(partId, cancel)
    } catch (error) {
      reports = emergencyReports(partId, error)
    }
    publish(partId, reports)
  }

  return {
    id,
    kind: "analyzer",
    participant: agent,
    isBusy: () => busyWith !== null,
    assign({ partId }) {
      if (busyWith !== null) {
        log({ agent: id, event: "task.ignored", data: { partId, reason: `busy with part "${busyWith}"` } })
        return
      }
      busyWith = partId
      guard = new CancelGuard()
      void analyze(partId, guard).catch((error) => {
        busyWith = null
        log({ agent: id, event: "analysis.crashed", data: { partId, error: message(error) } })
      })
    },
    cancel(reason) {
      guard?.cancel(reason)
    },
  }
}
