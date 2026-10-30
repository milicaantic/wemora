import { createHuman, SituationSpecification, type Participant, type SemanticEvent, type SituationContext } from "@mozaik-ai/core"
import type { AgentHandle, AnalyzeTask, ArchitectTask, BuildTask, TestTask } from "../agents/_shared"
import {
  EVENTS,
  type AgentKind,
  type BuildReport,
  type EventPayloads,
  type ParseApp,
  type Scaffold,
  type ScreenStatus,
  type SplitParts,
  type UnitState,
  type UnitStatus,
} from "../contracts"
import { FIXED_TEAM, modelForRound } from "../core/config"
import { log } from "../core/log"
import { board, emit, join, leave } from "../core/runtime"
import { createEventLogger } from "./eventLogger"
import { blockedBy, isFinished, nextForBuilder, nextForTester, type QueueView } from "./queue"

// The Conductor runs one migration (architecture.md §4, D-010): it starts agents, hands out tasks and
// reacts to their events. It never does the work itself; agents and domain functions come in through deps.

export type AgentFactories = {
  analyzer(id: string): AgentHandle<AnalyzeTask>
  architect(id: string): AgentHandle<ArchitectTask>
  tester(id: string): AgentHandle<TestTask>
  builder(id: string): AgentHandle<BuildTask>
  /** The Gatekeeper reacts to tests.ready and draft.submitted on its own (C). */
  gatekeeper(id: string): Participant
}

export type ConductorDeps = {
  parseApp: ParseApp
  splitParts: SplitParts
  scaffold: Scaffold
  buildReport: BuildReport
  agents: AgentFactories
}

/** Team size and rounds. F2 uses FIXED_TEAM; A14 and A15 replace it with the §9 formulas. */
export type ConductorOptions = Partial<{ analyzers: number; builders: number; testers: number; maxRounds: number }>

export type RunOutcome = "finished" | "plan.failed" | "budget.exceeded" | "error"

export type RunSummary = {
  runId: string
  runDir: string
  outcome: RunOutcome
  error?: string
  units: Record<string, UnitStatus>
  statuses: Record<string, ScreenStatus>
  reportPath: string | null
}

type Worker<T> = { kind: AgentKind; handle: AgentHandle<T>; task: string | null }
type AnyWorker = { kind: AgentKind; handle: Omit<AgentHandle<never>, "assign">; task: string | null }

const OUR_EVENTS = new Set<string>(Object.values(EVENTS))

class OurEvents extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return OUR_EVENTS.has(event.type)
  }
}

export class Conductor {
  private readonly team: { analyzers: number; builders: number; testers: number; maxRounds: number }
  private readonly participant: Participant
  private readonly logger = createEventLogger()
  private readonly byParticipant = new Map<string, AnyWorker>()
  private readonly analyzers: Worker<AnalyzeTask>[] = []
  private readonly architects: Worker<ArchitectTask>[] = []
  private readonly testers: Worker<TestTask>[] = []
  private readonly builders: Worker<BuildTask>[] = []
  private readonly gatekeepers: Participant[] = []
  private readonly counters = new Map<AgentKind, number>()
  // Events are handled one at a time, in arrival order, outside Mozaik's synchronous publish.
  private chain: Promise<void> = Promise.resolve()
  private resolveRun: (summary: RunSummary) => void = () => {}
  private partIds: string[] = []
  private readonly pendingParts: string[] = []
  private readonly analyzedParts = new Set<string>()
  private planHandled = false
  private budgetExceeded = false
  private finished = false

  constructor(
    private readonly deps: ConductorDeps,
    options: ConductorOptions = {},
  ) {
    this.team = { ...FIXED_TEAM, ...options }
    this.participant = createHuman({
      name: "conductor",
      capabilities: ["orchestrate"],
      handlers: [{ specification: new OurEvents(), processor: { apply: ({ event }) => this.enqueue(() => this.onEvent(event)) } }],
    })
  }

  /** Runs the whole migration on the initialized runtime and board; resolves when every unit is final. */
  run(): Promise<RunSummary> {
    const done = new Promise<RunSummary>((resolve) => (this.resolveRun = resolve))
    join(this.logger)
    join(this.participant)
    this.enqueue(() => this.start())
    return done
  }

  /** Called by the runner's onBudgetExceeded: sends budget.exceeded from the Conductor, which has joined. */
  notifyBudgetExceeded(): void {
    if (this.finished) return
    emit("budget.exceeded", {}, this.participant.getId())
  }

  private enqueue(work: () => Promise<void> | void): void {
    this.chain = this.chain.then(work).catch((error: unknown) => this.finish("error", describe(error)))
  }

  private async start(): Promise<void> {
    const { config } = board()
    const parsed = await this.deps.parseApp(config.webDir)
    const parts = this.deps.splitParts(parsed, Math.max(1, this.team.analyzers))
    if (parts.length === 0) throw new Error(`no parts to analyze in ${config.webDir}`)
    board().parsed = { ...parsed, parts }
    this.partIds = parts.map((part) => part.id)
    this.pendingParts.push(...this.partIds)
    log({ agent: "conductor", event: "run.started", data: { webDir: config.webDir, parts: this.partIds.length, team: this.team } })

    for (let i = 0; i < Math.min(this.team.analyzers, parts.length); i++) {
      this.analyzers.push(this.spawn("analyzer", this.deps.agents.analyzer))
    }
    this.assignParts()
  }

  private async onEvent(event: SemanticEvent): Promise<void> {
    if (this.finished) return
    const worker = this.byParticipant.get(event.producerId)
    switch (event.type) {
      case EVENTS.analysisDone:
        return this.onAnalysisDone(worker, event.payload as EventPayloads["analysis.done"])
      case EVENTS.planReady:
        if (worker) this.release(worker)
        return this.onPlanReady()
      case EVENTS.planFailed:
        return this.finish("plan.failed", "the architect could not produce a valid plan")
      case EVENTS.testsReady:
        return this.onTestsReady(worker, event.payload as EventPayloads["tests.ready"])
      case EVENTS.draftSubmitted:
        return this.setUnit((event.payload as EventPayloads["draft.submitted"]).unitId, { status: "submitted" })
      case EVENTS.gateFailed:
        return this.onGateFailed(event.payload as EventPayloads["gate.failed"])
      case EVENTS.unitPromoted:
        return this.onPromoted(event.payload as EventPayloads["unit.promoted"])
      case EVENTS.budgetExceeded:
        this.budgetExceeded = true
        log({ agent: "conductor", event: "dispatch.stopped", data: { reason: "budget.exceeded" } })
        return this.checkFinished()
    }
  }

  private onAnalysisDone(worker: AnyWorker | undefined, { partId }: EventPayloads["analysis.done"]): void {
    this.analyzedParts.add(partId)
    if (worker) this.release(worker)
    this.assignParts()
    const allDone = this.partIds.every((id) => this.analyzedParts.has(id))
    if (allDone && this.architects.length === 0) {
      const architect = this.spawn("architect", this.deps.agents.architect)
      this.architects.push(architect)
      this.assign(architect, { partIds: [...this.partIds] }, "plan")
    }
  }

  private assignParts(): void {
    for (const analyzer of this.analyzers) {
      const partId = analyzer.task === null ? this.pendingParts.shift() : undefined
      if (partId) this.assign(analyzer, { partId }, partId)
    }
  }

  private async onPlanReady(): Promise<void> {
    if (this.planHandled) return
    this.planHandled = true
    const { plan, config } = board()
    if (!plan) throw new Error("plan.ready arrived but board().plan is empty")
    await this.deps.scaffold(plan, config.runDir)
    for (const unit of plan.units) {
      board().units[unit.id] ??= { status: "waiting", round: 0, model: null, builderId: null, testerId: null, testAttempts: 0 }
    }
    this.gatekeepers.push(this.spawnGatekeeper())
    for (let i = 0; i < this.team.testers; i++) this.testers.push(this.spawn("tester", this.deps.agents.tester))
    for (let i = 0; i < this.team.builders; i++) this.builders.push(this.spawn("builder", this.deps.agents.builder))
    this.dispatch()
    await this.checkFinished()
  }

  private onTestsReady(worker: AnyWorker | undefined, { unitId }: EventPayloads["tests.ready"]): void {
    const tester = worker ?? this.testers.find((t) => t.task === unitId)
    if (tester) this.release(tester)
    this.dispatch()
  }

  // Same builder, next round, fresh context; after the last round the unit and everything that needs it fail.
  private async onGateFailed({ unitId, round }: EventPayloads["gate.failed"]): Promise<void> {
    const builder = this.builders.find((b) => b.task === unitId)
    if (round >= this.team.maxRounds || !builder) {
      this.failUnit(unitId, builder ? `failed after ${round} round(s)` : "no builder holds this unit")
      this.dispatch()
      return this.checkFinished()
    }
    const next = round + 1
    const model = modelForRound(next)
    this.setUnit(unitId, { status: "building", round: next, model })
    this.assign(builder, { unitId, round: next, model, lastError: this.lastGateError(unitId, round) }, unitId)
  }

  private async onPromoted({ unitId }: EventPayloads["unit.promoted"]): Promise<void> {
    this.setUnit(unitId, { status: "promoted" })
    const builder = this.builders.find((b) => b.task === unitId)
    if (builder) this.release(builder)
    this.dispatch()
    await this.checkFinished()
  }

  // Testers take screens from every wave at once; a builder keeps its unit until it is promoted or failed.
  private dispatch(): void {
    if (this.budgetExceeded || this.finished || !board().plan) return
    const beingTested = new Set(this.testers.flatMap((t) => (t.task ? [t.task] : [])))
    for (const tester of this.testers.filter((t) => t.task === null)) {
      const unit = nextForTester(this.view(), beingTested)
      if (!unit) break
      beingTested.add(unit.id)
      this.setUnit(unit.id, { testerId: tester.handle.id })
      this.assign(tester, { unitId: unit.id }, unit.id)
    }
    for (const builder of this.builders.filter((b) => b.task === null)) {
      const unit = nextForBuilder(this.view())
      if (!unit) break
      const model = modelForRound(1)
      this.setUnit(unit.id, { status: "building", round: 1, model, builderId: builder.handle.id })
      this.assign(builder, { unitId: unit.id, round: 1, model, lastError: null }, unit.id)
    }
  }

  private failUnit(unitId: string, reason: string): void {
    this.setUnit(unitId, { status: "failed" })
    const builder = this.builders.find((b) => b.task === unitId)
    if (builder) this.release(builder)
    log({ agent: "conductor", event: "unit.failed", data: { unitId, reason } })
    for (const blocked of blockedBy(this.view(), unitId)) {
      this.setUnit(blocked.id, { status: "failed" })
      log({ agent: "conductor", event: "unit.blocked", data: { unitId: blocked.id, because: unitId } })
    }
  }

  private async checkFinished(): Promise<void> {
    if (this.finished || !board().plan) return
    if (isFinished(this.view())) return this.finish("finished")
    const inProgress = Object.values(board().units).some((u) => u.status === "building" || u.status === "submitted")
    if (this.budgetExceeded && !inProgress) {
      for (const [unitId, unit] of Object.entries(board().units)) {
        if (unit.status === "waiting") this.failUnit(unitId, "budget exceeded")
      }
      return this.finish("budget.exceeded")
    }
  }

  private async finish(outcome: RunOutcome, error?: string): Promise<void> {
    if (this.finished) return
    this.finished = true
    const { runId, config } = board()
    log({ agent: "conductor", event: "run.finished", data: { outcome, error } })
    let reportPath: string | null = null
    try {
      reportPath = await this.deps.buildReport(config.runDir)
    } catch (reportError) {
      log({ agent: "conductor", event: "report.failed", data: { error: describe(reportError) } })
    }
    this.leaveAll()
    const units = Object.fromEntries(Object.entries(board().units).map(([id, unit]) => [id, unit.status]))
    this.resolveRun({ runId, runDir: config.runDir, outcome, error, units, statuses: { ...board().statuses }, reportPath })
  }

  private leaveAll(): void {
    for (const worker of this.byParticipant.values()) {
      if (worker.handle.isBusy()) worker.handle.cancel("run finished")
      safeLeave(worker.handle.participant)
      board().agents[worker.handle.id].busyWith = null
    }
    for (const gatekeeper of this.gatekeepers) safeLeave(gatekeeper)
    safeLeave(this.participant)
    safeLeave(this.logger)
  }

  private spawn<T>(kind: AgentKind, factory: (id: string) => AgentHandle<T>): Worker<T> {
    const id = this.nextId(kind)
    const worker: Worker<T> = { kind, handle: factory(id), task: null }
    join(worker.handle.participant)
    this.byParticipant.set(worker.handle.participant.getId(), worker)
    board().agents[id] = { id, kind, busyWith: null, joinedAt: new Date().toISOString() }
    log({ agent: "conductor", event: "agent.started", data: { id, kind } })
    return worker
  }

  private spawnGatekeeper(): Participant {
    const id = this.nextId("gatekeeper")
    const gatekeeper = this.deps.agents.gatekeeper(id)
    join(gatekeeper)
    board().agents[id] = { id, kind: "gatekeeper", busyWith: null, joinedAt: new Date().toISOString() }
    log({ agent: "conductor", event: "agent.started", data: { id, kind: "gatekeeper" } })
    return gatekeeper
  }

  private nextId(kind: AgentKind): string {
    const n = (this.counters.get(kind) ?? 0) + 1
    this.counters.set(kind, n)
    return `${kind}-${n}`
  }

  private assign<T>(worker: Worker<T>, task: T, label: string): void {
    worker.task = label
    board().agents[worker.handle.id].busyWith = label
    log({ agent: "conductor", event: "task.assigned", data: { to: worker.handle.id, task } })
    worker.handle.assign(task)
  }

  private release(worker: AnyWorker): void {
    worker.task = null
    const info = board().agents[worker.handle.id]
    if (info) info.busyWith = null
  }

  private setUnit(unitId: string, patch: Partial<UnitState>): void {
    const unit = board().units[unitId]
    if (unit) Object.assign(unit, patch)
    else log({ agent: "conductor", event: "unit.unknown", data: { unitId } })
  }

  // The builder gets the message of the last failed gate; the Gatekeeper writes results/<unitId> (C).
  private lastGateError(unitId: string, round: number): string {
    const failed = board().results[unitId]?.gates.filter((gate) => !gate.ok) ?? []
    return failed.at(-1)?.message ?? `the draft failed the gates in round ${round}`
  }

  private view(): QueueView {
    const { plan, units, tests } = board()
    return { plan, units, tests }
  }
}

function safeLeave(participant: Participant): void {
  try {
    leave(participant)
  } catch (error) {
    log({ agent: "conductor", event: "leave.failed", data: { id: participant.getId(), error: describe(error) } })
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
