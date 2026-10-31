import { z } from "zod"
import type { LogLine } from "./load"

// Pure: run.jsonl lines → the run's timeline (one row per agent), the speed-up and the team changes.
// Event names come from orchestration/eventLogger.ts and conductor.ts: a loop is
// message_received.started … model.answer with the same agent and data.loopId (Mozaik's own events).

export type AgentKindName = "analyzer" | "architect" | "tester" | "builder" | "other"

export type Bar = {
  agent: string
  start: string
  end: string
  durationMs: number
  /** What the agent worked on: "part-1", "plan", "todo-list · runda 2". */
  label: string
  /** The loop had no model.answer before the log ended. */
  open: boolean
}

export type AgentRow = { agent: string; kind: AgentKindName; bars: Bar[]; joined: string[]; left: string[] }

export type Timeline = {
  startedAt: string
  finishedAt: string
  windowMs: number
  rows: AgentRow[]
  /** Sum of all bar durations ÷ window; null without bars or with an empty window. */
  speedup: number | null
  busyMs: number
}

export type Rescale = { t: string; text: string }

const KINDS: AgentKindName[] = ["analyzer", "architect", "tester", "builder"]

const LoopData = z.looseObject({ loopId: z.string().min(1) })
const AgentStarted = z.looseObject({ id: z.string().min(1), kind: z.string().min(1) })
const TaskAssigned = z.looseObject({ to: z.string().min(1), task: z.record(z.string(), z.unknown()) })
const ParticipantData = z.looseObject({ name: z.string().min(1), role: z.string().optional() })
const RescaleData = z.looseObject({ reason: z.string().min(1) })

const ms = (iso: string) => Date.parse(iso)

function kindOf(agent: string, started: Map<string, string>): AgentKindName {
  const kind = started.get(agent) ?? agent.replace(/-\d+$/, "")
  return (KINDS as string[]).includes(kind) ? (kind as AgentKindName) : "other"
}

/** "part-1", "plan" or "todo-list · runda 2", from the task the Conductor gave the agent. */
function taskLabel(task: Record<string, unknown>): string {
  if (typeof task.unitId === "string") return typeof task.round === "number" ? `${task.unitId} · runda ${task.round}` : task.unitId
  if (typeof task.partId === "string") return task.partId
  if (Array.isArray(task.partIds)) return "plan"
  return ""
}

export function buildTimeline(log: LogLine[]): Timeline | null {
  const lines = log.filter((l) => !Number.isNaN(ms(l.t))).sort((a, b) => ms(a.t) - ms(b.t))
  if (lines.length === 0) return null

  const started = new Map<string, string>()
  const tasks = new Map<string, { t: string; label: string }[]>()
  const rows = new Map<string, AgentRow>()
  const row = (agent: string) => {
    let r = rows.get(agent)
    if (!r) rows.set(agent, (r = { agent, kind: "other", bars: [], joined: [], left: [] }))
    return r
  }
  const openLoops = new Map<string, { agent: string; start: string; label: string }>()
  const lastLabel = (agent: string, t: string) => [...(tasks.get(agent) ?? [])].reverse().find((x) => ms(x.t) <= ms(t))?.label ?? ""

  for (const l of lines) {
    const event = l.event ?? ""
    if (event === "agent.started") {
      const d = AgentStarted.safeParse(l.data)
      if (d.success) started.set(d.data.id, d.data.kind)
    } else if (event === "task.assigned") {
      const d = TaskAssigned.safeParse(l.data)
      if (d.success) tasks.set(d.data.to, [...(tasks.get(d.data.to) ?? []), { t: l.t, label: taskLabel(d.data.task) }])
    } else if (event === "participant.joined" || event === "participant.left") {
      const d = ParticipantData.safeParse(l.data)
      if (d.success && d.data.role === "agent") (event === "participant.joined" ? row(d.data.name).joined : row(d.data.name).left).push(l.t)
    } else if (event === "message_received.started" && l.agent) {
      const d = LoopData.safeParse(l.data)
      if (d.success) openLoops.set(d.data.loopId, { agent: l.agent, start: l.t, label: lastLabel(l.agent, l.t) })
    } else if (event === "model.answer" && l.agent) {
      const d = LoopData.safeParse(l.data)
      const loop = d.success ? openLoops.get(d.data.loopId) : undefined
      if (loop && loop.agent === l.agent) {
        openLoops.delete(d.data!.loopId)
        row(l.agent).bars.push({ agent: l.agent, start: loop.start, end: l.t, durationMs: ms(l.t) - ms(loop.start), label: loop.label, open: false })
      }
    }
  }

  const startedAt = lines[0]!.t
  const finishedAt = lines[lines.length - 1]!.t
  for (const loop of openLoops.values()) {
    row(loop.agent).bars.push({ agent: loop.agent, start: loop.start, end: finishedAt, durationMs: ms(finishedAt) - ms(loop.start), label: loop.label, open: true })
  }

  const ordered = [...rows.values()]
    .map((r) => ({ ...r, kind: kindOf(r.agent, started), bars: r.bars.sort((a, b) => ms(a.start) - ms(b.start)) }))
    .filter((r) => r.bars.length > 0 || r.kind !== "other")
    .sort((a, b) => KINDS.indexOf(a.kind as never) - KINDS.indexOf(b.kind as never) || a.agent.localeCompare(b.agent, "en", { numeric: true }))

  const windowMs = ms(finishedAt) - ms(startedAt)
  const busyMs = ordered.reduce((sum, r) => sum + r.bars.reduce((s, b) => s + b.durationMs, 0), 0)
  const speedup = windowMs > 0 && busyMs > 0 ? busyMs / windowMs : null
  return { startedAt, finishedAt, windowMs, rows: ordered, speedup, busyMs }
}

/** The Conductor's agents.rescaled lines (A14): when and why the team size changed. */
export function rescales(log: LogLine[]): Rescale[] {
  return log
    .filter((l) => l.event === "agents.rescaled")
    .flatMap((l) => {
      const d = RescaleData.safeParse(l.data)
      return d.success ? [{ t: l.t, text: d.data.reason }] : []
    })
    .sort((a, b) => ms(a.t) - ms(b.t))
}

export type UnitRounds = {
  unitId: string
  /** One per builder round, in order; model is null when the task did not name one. */
  rounds: { round: number; model: string | null; failed: boolean }[]
}

const BuildTask = z.looseObject({ unitId: z.string().min(1), round: z.number().int().positive(), model: z.string().optional() })
const GateFailed = z.looseObject({ unitId: z.string().min(1), round: z.number().int().positive() })

/** Builder rounds per unit (task.assigned with a round) and which of them the Gatekeeper rejected (gate.failed). */
export function unitRounds(log: LogLine[]): UnitRounds[] {
  const units = new Map<string, Map<number, { round: number; model: string | null; failed: boolean }>>()
  const round = (unitId: string, n: number) => {
    const rounds = units.get(unitId) ?? units.set(unitId, new Map()).get(unitId)!
    return rounds.get(n) ?? rounds.set(n, { round: n, model: null, failed: false }).get(n)!
  }
  for (const l of log) {
    if (l.event === "task.assigned") {
      const task = BuildTask.safeParse((l.data as { task?: unknown } | undefined)?.task)
      if (task.success) round(task.data.unitId, task.data.round).model = task.data.model ?? null
    } else if (l.event === "gate.failed") {
      const d = GateFailed.safeParse(l.data)
      if (d.success) round(d.data.unitId, d.data.round).failed = true
    }
  }
  return [...units.entries()]
    .map(([unitId, rounds]) => ({ unitId, rounds: [...rounds.values()].sort((a, b) => a.round - b.round) }))
    .sort((a, b) => a.unitId.localeCompare(b.unitId))
}

/** "3,4×": one decimal, Serbian decimal comma. */
export const speedupText = (speedup: number) => `${speedup.toFixed(1).replace(".", ",")}×`
