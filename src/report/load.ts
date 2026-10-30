import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import { PlanSchema, ScenarioSchema, UnitResultSchema, type Plan, type Scenario, type UnitResult } from "../contracts"

// One line of run.jsonl. Mock until core/log.ts (A6) exports LogEntry; only the fields
// the report reads are required, the rest is kept as is.
export const LogLineSchema = z.looseObject({
  t: z.string().min(1),
  agent: z.string().optional(),
  event: z.string().optional(),
  costUsd: z.number().optional(),
})
export type LogLine = z.infer<typeof LogLineSchema>

export type RunData = {
  runId: string
  plan: Plan | null
  /** Keyed by unitId (tests/<unitId>.json). */
  tests: Record<string, Scenario[]>
  /** Keyed by unitId (results/<unitId>.json). */
  results: Record<string, UnitResult>
  log: LogLine[]
  /** Files that are missing or do not match their schema. The report shows them instead of failing. */
  warnings: string[]
}

const zodMessage = (error: z.ZodError) =>
  error.issues.map((i) => `${i.path.length > 0 ? i.path.join(".") : "(root)"}: ${i.message}`).join("; ")

function readJson<T>(file: string, schema: z.ZodType<T>, label: string, warnings: string[]): T | null {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    warnings.push(`${label} nije ispravan JSON: ${(error as Error).message}`)
    return null
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    warnings.push(`${label} ne odgovara šemi: ${zodMessage(parsed.error)}`)
    return null
  }
  return parsed.data
}

/** `<dir>/*.json` files as { unitId: data }, sorted by name; bad files become warnings. */
function readDir<T>(runDir: string, dir: string, schema: z.ZodType<T>, warnings: string[]): Record<string, T> {
  const abs = path.join(runDir, dir)
  if (!existsSync(abs)) return {}
  const out: Record<string, T> = {}
  for (const name of readdirSync(abs).filter((f) => f.endsWith(".json")).sort()) {
    const data = readJson(path.join(abs, name), schema, `${dir}/${name}`, warnings)
    if (data !== null) out[name.slice(0, -".json".length)] = data
  }
  return out
}

function readLog(runDir: string, warnings: string[]): LogLine[] {
  const file = path.join(runDir, "run.jsonl")
  if (!existsSync(file)) {
    warnings.push("run.jsonl ne postoji")
    return []
  }
  const lines: LogLine[] = []
  let bad = 0
  for (const text of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (text.trim() === "") continue
    try {
      const parsed = LogLineSchema.safeParse(JSON.parse(text))
      if (parsed.success && !Number.isNaN(Date.parse(parsed.data.t))) lines.push(parsed.data)
      else bad++
    } catch {
      bad++
    }
  }
  if (bad > 0) warnings.push(`run.jsonl: ${bad} ${bad === 1 ? "neispravna linija je preskočena" : "neispravnih linija je preskočeno"}`)
  return lines
}

/** Reads everything the report needs from output/<run-id>/. Never throws for missing or bad files. */
export function loadRun(runDir: string): RunData {
  const warnings: string[] = []
  const planFile = path.join(runDir, "plan.json")
  let plan: Plan | null = null
  if (existsSync(planFile)) plan = readJson(planFile, PlanSchema, "plan.json", warnings)
  else warnings.push("plan.json ne postoji, pa izveštaj nema spisak jedinica")

  const tests = readDir(runDir, "tests", z.array(ScenarioSchema), warnings)
  const results = readDir(runDir, "results", UnitResultSchema, warnings)
  const log = readLog(runDir, warnings)

  if (plan) {
    const known = new Set(plan.units.map((u) => u.id))
    for (const id of Object.keys(tests)) if (!known.has(id)) warnings.push(`tests/${id}.json pripada jedinici koje nema u planu`)
    for (const id of Object.keys(results)) if (!known.has(id)) warnings.push(`results/${id}.json pripada jedinici koje nema u planu`)
  }
  return { runId: path.basename(path.resolve(runDir)), plan, tests, results, log, warnings }
}
