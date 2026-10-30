import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createAgent, type Tool } from "@mozaik-ai/core"
import { z } from "zod"
import type { Plan, Unit } from "../contracts"
import { log } from "../core/log"
import { board, emit } from "../core/runtime"
import { runGates } from "../gatekeeper"
import { CancelGuard, composeGuards, defineTool, OwnershipGuard, runTask, type AgentHandle, type BuildTask } from "./_shared"

// Builder agent (architecture.md §12): rewrites one unit for Expo in its staging folder,
// output/<run>/staging/<builderId>/<unitId>/ (same layout as app/src/). One assign = one round.
// It has no tool for tests (invariant 7): check_draft runs gates 1–4 and shows only their messages.

export const BUILDER_MAX_OUTPUT_TOKENS = 16_000

const promptFile = (name: string) => fileURLToPath(new URL(`./prompts/${name}`, import.meta.url))
let prompt: string | null = null
const builderPrompt = () =>
  (prompt ??= `${readFileSync(promptFile("builder.md"), "utf8")}\n\n${readFileSync(promptFile("web-to-rn.md"), "utf8")}`)

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
const posix = (p: string) => path.posix.normalize(p.replace(/\\/g, "/")).replace(/^\.\//, "")

/** Everything one round needs; the tools read it, between rounds there is none. */
export type BuildJob = {
  unit: Unit
  round: number
  /** Staging folder of this unit; same layout as app/src/. */
  draftDir: string
  appDir: string
  webDir: string
  /** Paths relative to app/src/ the unit may write, from Unit.writes (e.g. "screens/recipe-list/"). */
  allowed: string[]
  submitted: boolean
}

/** Unit.writes is relative to app/ ("src/screens/x/"); the model writes relative to app/src/ ("screens/x/"). */
export function allowedPaths(unit: Unit): string[] {
  const own = `${unit.kind === "screen" ? "screens" : "shared"}/${unit.id}/`
  const fromPlan = unit.writes.map((w) => posix(w).replace(/^src\//, "")).filter((w) => w !== "" && !w.startsWith(".."))
  return fromPlan.length > 0 ? fromPlan : [own]
}

/** The task message for one round: what to build, where, and what went wrong last time. */
export function builderBrief(job: Pick<BuildJob, "unit" | "round" | "allowed">, plan: Plan, lastError: string | null): string {
  const { unit, round, allowed } = job
  const lines = [`Unit: ${unit.id} (${unit.kind})`]
  if (unit.kind === "screen" && unit.route) {
    lines.push(`Web route: ${unit.route}`, `Mobile route: ${plan.routeMap[unit.route] ?? "(not in routeMap)"}`)
  }
  lines.push("", "Sources (read them with read_source):", ...unit.sources.map((s) => `- ${s}`))
  lines.push("", "You may write (paths relative to app/src/):", ...allowed.map((a) => `- ${a}`))
  lines.push("", "Obligations:", ...(unit.obligations.length ? unit.obligations.map((o) => `- ${o.id}: ${o.description}`) : ["- none"]))
  lines.push("", "Intentional differences:")
  lines.push(...(unit.intentionalDifferences.length ? unit.intentionalDifferences.map((d) => `- ${JSON.stringify(d)}`) : ["- none"]))
  const shared = plan.units.filter((u) => u.kind === "shared" && u.id !== unit.id).map((u) => u.id)
  if (shared.length) lines.push("", `Shared units (read them with read_app, import as @/shared/<id>): ${shared.join(", ")}`)
  lines.push("", `Round: ${round}`)
  if (round > 1) {
    lines.push(
      "Your draft from the last round is still in place; read_app shows it. Fix what the Gatekeeper reported:",
      lastError ?? "(no message)",
    )
  } else {
    lines.push("Start with read_source.")
  }
  return lines.join("\n")
}

/** Resolves `rel` inside `base`; throws for paths that leave it. */
function inside(base: string, rel: string): string {
  const clean = posix(rel)
  if (clean === ".." || clean.startsWith("../") || path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) {
    throw new Error(`"${rel}" is outside the allowed folder.`)
  }
  return path.join(base, clean === "." ? "" : clean)
}

function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.name === "node_modules") return []
    return e.isDirectory() ? listFiles(p, base) : [posix(path.relative(base, p))]
  })
}

export function builderTools(current: () => BuildJob | null): Tool[] {
  const job = () => {
    const j = current()
    if (!j) throw new Error("No build task is active.")
    return j
  }
  return [
    defineTool({
      name: "read_source",
      description: "Read one web source file of your unit, e.g. src/pages/RecipeListPage.tsx. Only the files listed under Sources.",
      args: z.strictObject({ path: z.string() }),
      invoke: async ({ path: file }) => {
        const j = job()
        const wanted = posix(file)
        if (!j.unit.sources.map(posix).includes(wanted)) {
          throw new Error(`"${file}" is not a source of this unit. Sources: ${j.unit.sources.join(", ")}`)
        }
        return readFileSync(inside(j.webDir, wanted), "utf8")
      },
    }),
    defineTool({
      name: "read_app",
      description:
        "Read the mobile app under app/src/ with your draft applied. A file path returns its content; a folder (or \".\") lists its files. Examples: \".\", \"shared/data/index.ts\".",
      args: z.strictObject({ path: z.string() }),
      invoke: async ({ path: rel }) => {
        const j = job()
        const fromDraft = inside(j.draftDir, rel)
        const fromApp = inside(path.join(j.appDir, "src"), rel)
        const file = [fromDraft, fromApp].find((p) => existsSync(p) && statSync(p).isFile())
        if (file) return readFileSync(file, "utf8")
        const files = [...new Set([...listFiles(fromApp, path.join(j.appDir, "src")), ...listFiles(fromDraft, j.draftDir)])].sort()
        if (files.length === 0) throw new Error(`"${rel}" does not exist in the app.`)
        return files.join("\n")
      },
    }),
    defineTool({
      name: "write_file",
      description: "Write a whole file of your draft. The path is relative to app/src/ and must be inside the paths you may write, e.g. screens/recipe-list/index.tsx.",
      args: z.strictObject({ path: z.string(), content: z.string() }),
      invoke: async ({ path: rel, content }) => {
        const j = job()
        const clean = posix(rel)
        if (!j.allowed.some((a) => (a.endsWith("/") ? clean.startsWith(a) : clean === a))) {
          throw new Error(`Rejected: you may only write inside ${j.allowed.join(", ")}`)
        }
        const target = inside(j.draftDir, clean)
        mkdirSync(path.dirname(target), { recursive: true })
        writeFileSync(target, content)
        return `Wrote ${clean} (${content.length} characters).`
      },
    }),
    defineTool({
      name: "check_draft",
      description: "Run the fast checks on your draft: syntax, web-only APIs, types, labels. Fix every error, then run it again.",
      args: z.strictObject({}),
      invoke: async () => {
        const j = job()
        const results = await runGates({
          draftDir: j.draftDir,
          appDir: j.appDir,
          tests: board().tests[j.unit.id] ?? [],
          originalFiles: j.unit.sources.map((s) => path.join(j.webDir, s)),
        })
        const failed = results.find((r) => !r.ok)
        if (failed) return `FAILED at ${failed.gate}:\n${failed.message}`
        return `All checks passed (${results.map((r) => r.gate).join(", ")}). Now call submit_draft.`
      },
    }),
    defineTool({
      name: "submit_draft",
      description: "Hand your draft to the Gatekeeper. Call it once, after check_draft passes; it ends your round.",
      args: z.strictObject({}),
      invoke: async () => {
        job().submitted = true
        return "Submitted. Your round is over: reply with one short sentence and call no more tools."
      },
    }),
  ]
}

export function createBuilder(id: string): AgentHandle<BuildTask> {
  let job: BuildJob | null = null
  let busyWith: string | null = null
  let cancel: CancelGuard | null = null

  const tools = builderTools(() => job)
  const agent = createAgent({
    name: id,
    capabilities: ["build"],
    instruction: "Builder of an Expo app. Each task brings its own instructions.",
    tools,
    handlers: [],
  })

  function startJob(task: BuildTask): { job: BuildJob; brief: string } {
    const plan = board().plan
    if (!plan) throw new Error("the board has no plan (board().plan is null)")
    const unit = plan.units.find((u) => u.id === task.unitId)
    if (!unit) throw new Error(`unit "${task.unitId}" is not in the plan`)
    const { runDir, webDir } = board().config
    const draftDir = path.join(runDir, "staging", id, unit.id)
    mkdirSync(draftDir, { recursive: true })
    const j: BuildJob = {
      unit,
      round: task.round,
      draftDir,
      appDir: path.join(runDir, "app"),
      webDir,
      allowed: allowedPaths(unit),
      submitted: false,
    }
    return { job: j, brief: builderBrief(j, plan, task.lastError) }
  }

  async function build(task: BuildTask, guard: CancelGuard): Promise<void> {
    try {
      const started = startJob(task)
      job = started.job
      const result = await runTask(agent, {
        prompt: builderPrompt(),
        message: started.brief,
        meta: { agentId: id, kind: "builder", taskId: task.unitId, round: task.round },
        model: task.model,
        maxOutputTokens: BUILDER_MAX_OUTPUT_TOKENS,
        tools,
        guard: composeGuards(new OwnershipGuard(started.job.allowed), guard),
      })
      if (!result.ok) log({ agent: id, event: "build.loop_failed", data: { unitId: task.unitId, round: task.round, error: result.error } })
      // Without submit_draft the round would hang until the timeout; the Gatekeeper judges the draft as it is.
      if (!started.job.submitted) log({ agent: id, event: "build.auto_submitted", data: { unitId: task.unitId, round: task.round } })
    } catch (error) {
      log({ agent: id, event: "build.failed", data: { unitId: task.unitId, round: task.round, error: message(error) } })
    } finally {
      job = null
    }
    // Free before emitting: the Gatekeeper's answer may reach the Conductor in the same call.
    busyWith = null
    cancel = null
    try {
      emit("draft.submitted", { unitId: task.unitId, round: task.round }, agent.getId())
    } catch (error) {
      log({ agent: id, event: "build.emit_failed", data: { unitId: task.unitId, error: message(error) } })
    }
  }

  return {
    id,
    kind: "builder",
    participant: agent,
    isBusy: () => busyWith !== null,
    assign(task) {
      if (busyWith !== null) {
        log({ agent: id, event: "task.ignored", data: { unitId: task.unitId, reason: `busy with unit "${busyWith}"` } })
        return
      }
      busyWith = task.unitId
      cancel = new CancelGuard()
      void build(task, cancel).catch((error) => {
        busyWith = null
        log({ agent: id, event: "build.crashed", data: { unitId: task.unitId, error: message(error) } })
      })
    },
    cancel(reason) {
      cancel?.cancel(reason)
    },
  }
}
