import { z } from "zod"
import type { ElementRef, IntentionalDifference, ScreenStatus, TapTarget, Unit, UnitResult } from "../contracts"
import { costTable, type CostTable } from "./costs"
import type { RunData } from "./load"
import { buildTimeline, rescales, unitRounds, type Rescale, type Timeline, type UnitRounds } from "./timeline"

// Pure: RunData → what the page shows. No disk, no clock, so the same run always gives the same report.

export type RowStatus = ScreenStatus | "no-result"

export type ScenarioRow = {
  id: string
  obligation: string
  outcome: "pass" | "fail" | "not-run"
  failedStep?: number
  error?: string
}

export type ScreenRow = {
  unitId: string
  route: string
  wave: number
  status: RowStatus
  reason: string | null
  rounds: number | null
  obligations: { covered: number; total: number; missing: string[] }
  /** null when the Gatekeeper did not compute coverage for this unit. */
  elements: { covered: number; total: number; missing: string[]; notPortable: number } | null
  /** "4/4 obaveze, 6/7 elemenata (nedostaje 'Izvezi CSV')" */
  coverageText: string
  differences: string[]
  scenarios: ScenarioRow[]
}

export type SharedRow = {
  unitId: string
  sources: number
  status: "promoted" | "failed" | "no-result"
  rounds: number | null
  reason: string | null
}

/** How the run ended, from the Conductor's last `run.finished` line; null when it ended normally or is unknown. */
export type RunStop = {
  outcome: string
  /** One sentence for the page, in Serbian. */
  text: string
  /** The architect's errors when the plan failed. */
  planErrors: string[]
}

export type ReportModel = {
  runId: string
  startedAt: string | null
  finishedAt: string | null
  durationText: string | null
  stop: RunStop | null
  counts: Record<RowStatus, number>
  screens: ScreenRow[]
  shared: SharedRow[]
  /** v2 (D17): computed from run.jsonl only. */
  timeline: Timeline | null
  rescales: Rescale[]
  costs: CostTable
  rounds: UnitRounds[]
  warnings: string[]
}

const quote = (s: string) => `'${s}'`

function refText(ref: ElementRef | TapTarget): string {
  if ("name" in ref) return quote(ref.name)
  if ("text" in ref) return quote(ref.text)
  return quote(ref.label)
}

/** One sentence per intentional difference, in Serbian. */
export function describeDifference(d: IntentionalDifference): string {
  switch (d.kind) {
    case "hiddenBehind":
      return `${refText(d.element)} je na telefonu iza ${refText(d.reveal)}`
    case "movedTo":
      return `${d.what} je prebačeno na ekran ${d.toUnit}`
    case "notPortable":
      return `${d.element.role} ${quote(d.element.name)} nije prenosivo: ${d.reason}`
  }
}

function lastFailedGate(result: UnitResult) {
  return [...result.gates].reverse().find((g) => !g.ok) ?? null
}

function screenReason(status: RowStatus, result: UnitResult | undefined, row: Omit<ScreenRow, "reason" | "coverageText">): string | null {
  if (result?.reason) return result.reason
  switch (status) {
    case "proven":
      return null
    case "no-result":
      return "nema rezultata: jedinica nije završena u ovom prolazu"
    case "unproven":
      return "nema validiranih testova"
    case "failed": {
      const gate = result ? lastFailedGate(result) : null
      if (gate) return `pada u rundi ${gate.round} na kapiji ${gate.gate}: ${gate.message}`
      const failing = row.scenarios.filter((s) => s.outcome === "fail").length
      return `${failing} ${failing === 1 ? "test pada" : "testova pada"} posle poslednje runde`
    }
    case "partial": {
      const parts: string[] = []
      if (row.obligations.missing.length > 0) parts.push(`obaveze bez testa: ${row.obligations.missing.join(", ")}`)
      if (row.elements && row.elements.missing.length > 0) parts.push(`nedostaju elementi: ${row.elements.missing.map(quote).join(", ")}`)
      return parts.length > 0 ? parts.join("; ") : "pokrivenost nije potpuna"
    }
  }
}

function coverageText(row: Pick<ScreenRow, "obligations" | "elements">): string {
  const obligations = `${row.obligations.covered}/${row.obligations.total} obaveze`
  if (!row.elements) return `${obligations}, elementi nisu izmereni`
  const missing = row.elements.missing.length > 0 ? ` (nedostaje ${row.elements.missing.map(quote).join(", ")})` : ""
  return `${obligations}, ${row.elements.covered}/${row.elements.total} elemenata${missing}`
}

function screenRow(unit: Unit, data: RunData): ScreenRow {
  const result = data.results[unit.id]
  const tests = data.tests[unit.id] ?? []
  const outcomes = new Map((result?.scenarios ?? []).map((s) => [s.scenarioId, s]))

  const scenarios: ScenarioRow[] = tests.map((t) => {
    const r = outcomes.get(t.id)
    if (!r) return { id: t.id, obligation: t.obligation, outcome: "not-run" }
    return r.ok
      ? { id: t.id, obligation: t.obligation, outcome: "pass" }
      : { id: t.id, obligation: t.obligation, outcome: "fail", failedStep: r.failedStep, error: r.error }
  })

  // Coverage from the Gatekeeper when it exists; otherwise obligations are counted from the saved tests.
  const planned = unit.obligations.map((o) => o.id)
  const tested = new Set(tests.map((t) => t.obligation))
  const coverage = result?.coverage ?? null
  const missingObligations = coverage ? coverage.obligations.missing : planned.filter((id) => !tested.has(id))
  const obligations = { covered: planned.length - missingObligations.length, total: planned.length, missing: missingObligations }
  const elements = coverage
    ? {
        covered: coverage.elements.covered.length,
        total: coverage.elements.covered.length + coverage.elements.missing.length,
        missing: coverage.elements.missing.map((e) => e.name),
        notPortable: coverage.elements.notPortable.length,
      }
    : null

  const status: RowStatus = result?.status ?? "no-result"
  const base = {
    unitId: unit.id,
    route: unit.route ?? "",
    wave: unit.wave,
    status,
    rounds: result?.rounds ?? null,
    obligations,
    elements,
    differences: unit.intentionalDifferences.map(describeDifference),
    scenarios,
  }
  return { ...base, reason: screenReason(status, result, base), coverageText: coverageText(base) }
}

function sharedRow(unit: Unit, data: RunData): SharedRow {
  const result = data.results[unit.id]
  if (!result) return { unitId: unit.id, sources: unit.sources.length, status: "no-result", rounds: null, reason: "nema rezultata" }
  const failed = result.status === "failed"
  const gate = failed ? lastFailedGate(result) : null
  return {
    unitId: unit.id,
    sources: unit.sources.length,
    status: failed ? "failed" : "promoted",
    rounds: result.rounds,
    reason: result.reason ?? (gate ? `pada u rundi ${gate.round} na kapiji ${gate.gate}: ${gate.message}` : null),
  }
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`
}

// The Conductor logs { event: "run.finished", data: { outcome, error } } (orchestration/conductor.ts).
const RunFinishedSchema = z.looseObject({ outcome: z.string().min(1), error: z.string().nullish() })

const STOP_TEXT: Record<string, string> = {
  "plan.failed": "Prolaz je stao: arhitekta ni posle ponovnih pokušaja nije napravio plan koji prolazi proveru.",
  "budget.exceeded": "Prolaz je stao: potrošen je budžet, pa jedinice koje nisu završene nemaju rezultat.",
  error: "Prolaz je stao zbog greške",
}

export function runStop(data: Pick<RunData, "log" | "planErrors">): RunStop | null {
  const last = [...data.log].reverse().find((l) => l.event === "run.finished")
  const finished = RunFinishedSchema.safeParse(last?.data)
  if (!finished.success || finished.data.outcome === "finished") return null
  const { outcome, error } = finished.data
  const base = STOP_TEXT[outcome] ?? `Prolaz je stao (${outcome})`
  const text = outcome === "error" || !STOP_TEXT[outcome] ? `${base}${error ? `: ${error}` : "."}` : base
  return { outcome, text, planErrors: outcome === "plan.failed" ? (data.planErrors ?? []) : [] }
}

export function toReportModel(data: RunData): ReportModel {
  const units = data.plan?.units ?? []
  const screens = units
    .filter((u) => u.kind === "screen")
    .map((u) => screenRow(u, data))
    .sort((a, b) => a.wave - b.wave || a.unitId.localeCompare(b.unitId))
  const shared = units
    .filter((u) => u.kind === "shared")
    .map((u) => sharedRow(u, data))
    .sort((a, b) => a.unitId.localeCompare(b.unitId))

  const counts: Record<RowStatus, number> = { proven: 0, partial: 0, unproven: 0, failed: 0, "no-result": 0 }
  for (const s of screens) counts[s.status]++

  const times = data.log.map((l) => l.t).sort()
  const startedAt = times[0] ?? null
  const finishedAt = times[times.length - 1] ?? null
  const durationText = startedAt && finishedAt ? formatDuration(Date.parse(finishedAt) - Date.parse(startedAt)) : null

  return {
    runId: data.runId,
    startedAt,
    finishedAt,
    durationText,
    stop: runStop(data),
    counts,
    screens,
    shared,
    timeline: buildTimeline(data.log),
    rescales: rescales(data.log),
    costs: costTable(data.log),
    rounds: unitRounds(data.log),
    warnings: data.warnings,
  }
}
