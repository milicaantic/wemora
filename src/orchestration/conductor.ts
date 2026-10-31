import { createHuman, SituationSpecification, type Participant, type SemanticEvent, type SituationContext } from "@mozaik-ai/core"
import type { AgentHandle, AnalyzeTask, ArchitectTask, BuildTask, TestTask } from "../agents/_shared"
import {
  EVENTS,
  type AgentKind,
  type BuildReport,
  type EventPayloads,
  type Flow,
  type ParseApp,
  type Scaffold,
  type ScreenStatus,
  type SplitParts,
  type UnitState,
  type UnitStatus,
} from "../contracts"
import { analyzerCount, DEFAULTS, modelForRound } from "../core/config"
import { log } from "../core/log"
import { board, emit, join, leave } from "../core/runtime"
import { createEventLogger } from "./eventLogger"
import { blockedBy, isFinished, nextForBuilder, nextForTester, readyUnits, type QueueView } from "./queue"
import { planAgentCounts, Rescaler, type AgentCounts } from "./scaling"
import { realClock, Timers, type Clock } from "./timeouts"

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

/**
 * The team follows the §9 formulas (A14) unless `team` fixes it (tests, comparisons). A unit gets
 * DEFAULTS.maxRounds rounds, the later ones on the strong model (A15). The clock drives timeouts and the
 * one-change-per-minute limit.
 */
export type ConductorOptions = {
  team?: { analyzers: number; builders: number; testers: number }
  maxRounds?: number
  clock?: Clock
}

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
  private readonly fixedTeam: ConductorOptions["team"]
  private readonly maxRounds: number
  private readonly rescaler: Rescaler
  private readonly participant: Participant
  private readonly logger = createEventLogger()
  private readonly byParticipant = new Map<string, AnyWorker>()
  private readonly analyzers: Worker<AnalyzeTask>[] = []
  private readonly architects: Worker<ArchitectTask>[] = []
  private readonly testers: Worker<TestTask>[] = []
  private readonly builders: Worker<BuildTask>[] = []
  private readonly gatekeepers: Participant[] = []
  private readonly counters = new Map<AgentKind, number>()
  private readonly timers: Timers
  // Events are handled one at a time, in arrival order, outside Mozaik's synchronous publish.
  private chain: Promise<void> = Promise.resolve()
  private resolveRun: (summary: RunSummary) => void = () => {}
  private partIds: string[] = []
  private readonly pendingParts: string[] = []
  private readonly analyzedParts = new Set<string>()
  private planHandled = false
  private budgetExceeded = false
  private finished = false
  // A16: the builder limit while the API answers 429 (null = config.maxBuilders), and whether one came in this window.
  private rateLimit: number | null = null
  private rateLimitedAgain = false
  private readonly testsArrived = new Set<string>()
  // D-022 step 2: flows a tester works on, flows done with testing (tests came, or gave up), tries per flow.
  private readonly flowsTesting = new Set<string>()
  private readonly flowsSettled = new Set<string>()
  private readonly flowsWithTests = new Set<string>()
  private readonly flowAttempts = new Map<string, number>()

  constructor(
    private readonly deps: ConductorDeps,
    options: ConductorOptions = {},
  ) {
    this.fixedTeam = options.team
    this.maxRounds = options.maxRounds ?? DEFAULTS.maxRounds
    this.timers = new Timers(options.clock ?? realClock)
    // A change refused inside the interval is counted again when it ends.
    this.rescaler = new Rescaler(options.clock ?? realClock, DEFAULTS.rescaleIntervalMs, () => this.enqueue(() => this.dispatch()))
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

  /** Called by the runner's onRateLimited on every 429 or 529 (A16). */
  notifyRateLimited(): void {
    this.enqueue(() => this.onRateLimited())
  }

  private enqueue(work: () => Promise<void> | void): void {
    this.chain = this.chain.then(work).catch((error: unknown) => this.finish("error", describe(error)))
  }

  private async start(): Promise<void> {
    const { config } = board()
    const parsed = await this.deps.parseApp(config.webDir)
    const analyzers = Math.max(1, this.fixedTeam?.analyzers ?? analyzerCount(parsed.totalTokens))
    const parts = this.deps.splitParts(parsed, analyzers)
    if (parts.length === 0) throw new Error(`no parts to analyze in ${config.webDir}`)
    board().parsed = { ...parsed, parts }
    this.partIds = parts.map((part) => part.id)
    this.pendingParts.push(...this.partIds)
    log({ agent: "conductor", event: "run.started", data: { webDir: config.webDir, parts: this.partIds.length, fixedTeam: this.fixedTeam ?? null } })
    const reason = this.fixedTeam ? "fixed team" : `${parsed.totalTokens} tokens → ${analyzers} analyzer(s)`
    log({ agent: "conductor", event: "agents.rescaled", data: { analyzers, builders: 0, testers: 0, reason } })

    for (let i = 0; i < Math.min(analyzers, parts.length); i++) {
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
        if (this.budgetExceeded) return this.finish("budget.exceeded", "the budget ran out before the plan")
        return this.finish("plan.failed", "the architect could not produce a valid plan")
      case EVENTS.testsReady:
        return this.onTestsReady(worker, event.payload as EventPayloads["tests.ready"])
      case EVENTS.flowTestsReady:
        return this.onFlowTestsReady(worker, event.payload as EventPayloads["flow.tests.ready"])
      case EVENTS.testsMissing:
        return // sent by the Conductor itself for the Gatekeeper (D-016)
      case EVENTS.draftSubmitted:
        return this.onDraftSubmitted(event.payload as EventPayloads["draft.submitted"])
      case EVENTS.gateFailed: {
        const { unitId, round } = event.payload as EventPayloads["gate.failed"]
        if (this.isStale(unitId, round, EVENTS.gateFailed)) return
        return this.roundFailed(unitId, round, this.lastGateError(unitId, round))
      }
      case EVENTS.unitPromoted:
        return this.onPromoted(event.payload as EventPayloads["unit.promoted"])
      case EVENTS.budgetExceeded:
        if (this.budgetExceeded) return
        this.budgetExceeded = true
        log({ agent: "conductor", event: "dispatch.stopped", data: { reason: "budget.exceeded" } })
        if (!board().plan) return this.endBeforePlan()
        this.stopForBudget()
        return this.checkFinished()
    }
  }

  private onAnalysisDone(worker: AnyWorker | undefined, { partId }: EventPayloads["analysis.done"]): Promise<void> | void {
    this.analyzedParts.add(partId)
    if (worker) this.release(worker)
    if (this.budgetExceeded) return this.endBeforePlan()
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
    // With the formulas, the first dispatch starts the testers and builders (A14).
    if (this.fixedTeam) {
      for (let i = 0; i < this.fixedTeam.testers; i++) this.testers.push(this.spawn("tester", this.deps.agents.tester))
      for (let i = 0; i < this.fixedTeam.builders; i++) this.builders.push(this.spawn("builder", this.deps.agents.builder))
    }
    this.dispatch()
    await this.checkFinished()
  }

  // Tests may also arrive late from a tester that already timed out; they still count, but only the tester
  // that currently holds the screen is freed.
  private onTestsReady(worker: AnyWorker | undefined, { unitId }: EventPayloads["tests.ready"]): void {
    this.testsArrived.add(unitId)
    this.timers.clear(`tests:${unitId}`)
    const tester = this.testers.find((t) => t.task === unitId && (!worker || t === worker))
    if (tester) this.release(tester)
    this.dispatch()
  }

  private onFlowTestsReady(worker: AnyWorker | undefined, { flowId }: EventPayloads["flow.tests.ready"]): Promise<void> {
    const label = flowLabel(flowId)
    this.timers.clear(`tests:${label}`)
    this.flowsTesting.delete(flowId)
    this.flowsSettled.add(flowId)
    this.flowsWithTests.add(flowId)
    const tester = this.testers.find((t) => t.task === label && (!worker || t === worker))
    if (tester) this.release(tester)
    this.dispatch()
    return this.checkFinished()
  }

  private onDraftSubmitted({ unitId, round }: EventPayloads["draft.submitted"]): void {
    if (this.isStale(unitId, round, EVENTS.draftSubmitted)) return
    this.timers.clear(`build:${unitId}`)
    this.setUnit(unitId, { status: "submitted" })
  }

  // Same builder, next round, fresh context; from DEFAULTS.escalationRound on with MODELS.strong (A15).
  // After the last round the unit and everything that needs it fail.
  private async roundFailed(unitId: string, round: number, lastError: string): Promise<void> {
    this.timers.clear(`build:${unitId}`)
    const builder = this.builders.find((b) => b.task === unitId)
    if (this.budgetExceeded || round >= this.maxRounds || !builder) {
      const reason = this.budgetExceeded ? "budget exceeded" : builder ? `failed after ${round} round(s)` : "no builder holds this unit"
      this.failUnit(unitId, reason)
      this.dispatch()
      return this.checkFinished()
    }
    const next = round + 1
    const model = modelForRound(next)
    this.setUnit(unitId, { status: "building", round: next, model })
    this.assign(builder, { unitId, round: next, model, lastError }, unitId)
  }

  private onTestsTimeout(label: string): Promise<void> | void {
    return this.testerSentNothing(label, true)
  }

  // A tester whose loop ended without its result event gave up (tests.none) or crashed, so the Conductor
  // does not wait for the timeout (D-028). A result is always handled first: the tester sends it in the
  // same step it becomes idle, and the event goes into the same queue before this check.
  private watchTester(worker: AnyWorker, label: string): Promise<void> | void {
    if (this.finished || worker.task !== label) return
    if (!worker.handle.isBusy()) return this.testerSentNothing(label, false)
    this.timers.start(`watch:${worker.handle.id}`, DEFAULTS.idleCheckMs, () => this.enqueue(() => this.watchTester(worker, label)))
  }

  // A tester that timed out (cancelled here) or ended with no tests: the screen goes back to the queue,
  // after untried screens, and after the last attempt the Gatekeeper hears tests.missing (D-016). A flow
  // is tried again, then stays without tests and the report says it was not checked.
  private testerSentNothing(label: string, timedOut: boolean): Promise<void> | void {
    const tester = this.testers.find((t) => t.task === label)
    if (!tester || this.finished) return
    const isFlow = label.startsWith(FLOW)
    const minutes = DEFAULTS.testsWaitTimeoutMs / 60_000
    if (timedOut) tester.handle.cancel(`timeout: no ${isFlow ? "flow.tests.ready" : "tests.ready"} within ${minutes} min`)
    this.timers.clear(`tests:${label}`)
    this.release(tester)
    if (isFlow) {
      const flowId = label.slice(FLOW.length)
      this.flowsTesting.delete(flowId)
      const attempt = (this.flowAttempts.get(flowId) ?? 0) + 1
      this.flowAttempts.set(flowId, attempt)
      const gaveUp = attempt >= DEFAULTS.maxTestAttempts
      if (gaveUp) this.flowsSettled.add(flowId)
      const event = timedOut ? "flow.tests.timeout" : "tests.ended_empty"
      log({ agent: "conductor", event, data: { flowId, tester: tester.handle.id, attempt, gaveUp } })
      this.dispatch()
      return this.checkFinished()
    }
    const attempts = (board().units[label]?.testAttempts ?? 0) + 1
    this.setUnit(label, { testAttempts: attempts, testerId: null })
    const gaveUp = attempts >= DEFAULTS.maxTestAttempts
    const event = timedOut ? "tests.timeout" : "tests.ended_empty"
    log({ agent: "conductor", event, data: { unitId: label, tester: tester.handle.id, attempt: attempts, gaveUp } })
    if (gaveUp) emit("tests.missing", { unitId: label }, this.participant.getId())
    this.dispatch()
  }

  // A builder that submits nothing for builderRoundTimeoutMs is cancelled; that round counts as failed (P10).
  private async onBuildTimeout(unitId: string): Promise<void> {
    const builder = this.builders.find((b) => b.task === unitId)
    const unit = board().units[unitId]
    if (!builder || !unit || unit.status !== "building" || this.finished) return
    const minutes = DEFAULTS.builderRoundTimeoutMs / 60_000
    builder.handle.cancel(`timeout: no draft within ${minutes} min`)
    log({ agent: "conductor", event: "build.timeout", data: { unitId, builder: builder.handle.id, round: unit.round } })
    await this.roundFailed(unitId, unit.round, `no draft was submitted within ${minutes} min in round ${unit.round}; submit sooner`)
  }

  // An event for an earlier round comes from a loop that already timed out; the current round decides.
  private isStale(unitId: string, round: number, type: string): boolean {
    const current = board().units[unitId]?.round
    if (current === undefined || round === current) return false
    log({ agent: "conductor", event: "event.stale", data: { type, unitId, round, current } })
    return true
  }

  private async onPromoted({ unitId }: EventPayloads["unit.promoted"]): Promise<void> {
    this.timers.clear(`build:${unitId}`)
    this.timers.clear(`tests:${unitId}`)
    this.setUnit(unitId, { status: "promoted" })
    const builder = this.builders.find((b) => b.task === unitId)
    if (builder) this.release(builder)
    this.dispatch()
    await this.checkFinished()
  }

  // Testers take screens from every wave at once; a builder keeps its unit until it is promoted or failed.
  private dispatch(): void {
    if (this.budgetExceeded || this.finished || !board().plan) return
    this.rescale()
    const beingTested = new Set(this.testers.flatMap((t) => (t.task ? [t.task] : [])))
    for (const tester of this.testers.filter((t) => t.task === null)) {
      const unit = nextForTester(this.view(), beingTested)
      if (unit) {
        beingTested.add(unit.id)
        this.setUnit(unit.id, { testerId: tester.handle.id })
        this.assign(tester, { unitId: unit.id }, unit.id)
        continue
      }
      // Screens first; a flow goes to a free tester once every screen of it has tests (D-022).
      const flow = this.nextFlow()
      if (!flow) break
      this.flowsTesting.add(flow.id)
      this.assign(tester, { flowId: flow.id }, flowLabel(flow.id))
    }
    // While the API answers 429, fewer builders work at once, even before rescale() lets idle ones go.
    let working = this.builders.filter((b) => b.task !== null).length
    for (const builder of this.builders.filter((b) => b.task === null)) {
      if (working >= this.builderLimit()) break
      const unit = nextForBuilder(this.view())
      if (!unit) break
      working++
      const model = modelForRound(1)
      this.setUnit(unit.id, { status: "building", round: 1, model, builderId: builder.handle.id })
      this.assign(builder, { unitId: unit.id, round: 1, model, lastError: null }, unit.id)
    }
  }

  // §9 counts before every dispatch; at most one change per minute, and only idle agents leave (A14).
  private rescale(): void {
    if (this.fixedTeam) return
    const { config, parsed } = board()
    const counts = planAgentCounts({
      totalTokens: parsed?.totalTokens ?? 0,
      readyUnits: readyUnits(this.view()).length,
      busyBuilders: this.builders.filter((b) => b.task !== null).length,
      maxBuilders: this.builderLimit(),
      maxTesters: config.maxTesters,
      ...this.testerBacklog(),
    })
    const builders = reachable(this.builders, counts.builders)
    const testers = reachable(this.testers, counts.testers)
    if (builders === this.builders.length && testers === this.testers.length) return
    const kept = [
      ...(builders > counts.builders ? [`${builders - counts.builders} busy builder(s) stay`] : []),
      ...(testers > counts.testers ? [`${testers - counts.testers} busy tester(s) stay`] : []),
    ]
    const reason = [counts.reason, ...kept].join("; ")
    this.rescaler.maybeApply({ ...counts, builders, testers, reason }, (next) => this.applyCounts(next))
  }

  private applyCounts(next: AgentCounts): void {
    const from = { builders: this.builders.length, testers: this.testers.length }
    this.resize(this.testers, next.testers, "tester", this.deps.agents.tester)
    this.resize(this.builders, next.builders, "builder", this.deps.agents.builder)
    log({
      agent: "conductor",
      event: "agents.rescaled",
      data: { analyzers: this.analyzers.length, builders: next.builders, testers: next.testers, from, reason: next.reason },
    })
  }

  private resize<T>(workers: Worker<T>[], target: number, kind: AgentKind, factory: (id: string) => AgentHandle<T>): void {
    while (workers.length < target) workers.push(this.spawn(kind, factory))
    for (const worker of workers.filter(isIdle)) {
      if (workers.length <= target) break
      workers.splice(workers.indexOf(worker), 1)
      this.stopAgent(worker)
    }
  }

  private stopAgent(worker: AnyWorker): void {
    this.byParticipant.delete(worker.handle.participant.getId())
    safeLeave(worker.handle.participant)
    log({ agent: "conductor", event: "agent.stopped", data: { id: worker.handle.id, kind: worker.kind } })
  }

  private nextFlow(): Flow | undefined {
    return (board().plan?.flows ?? []).find(
      (f) => !this.flowsTesting.has(f.id) && !this.flowsSettled.has(f.id) && f.unitIds.every((u) => this.testsArrived.has(u)),
    )
  }

  // The run waits for flows being tested, flows that will be (every screen has tests), and flows the
  // Gatekeeper still has to check: it writes flowResults without an event.
  private flowsPending(): boolean {
    const { plan, units, flowResults } = board()
    return (plan?.flows ?? []).some((flow) => {
      if (this.flowsTesting.has(flow.id)) return true
      if (!this.budgetExceeded && !this.flowsSettled.has(flow.id) && flow.unitIds.every((u) => this.testsArrived.has(u))) return true
      const checkable = this.flowsWithTests.has(flow.id) && flow.unitIds.every((u) => units[u]?.status === "promoted")
      return checkable && !flowResults[flow.id]
    })
  }

  // A17: screens no tester has taken yet (and that may still get tests), and drafts held for their tests.
  private testerBacklog(): { untestedScreens: number; draftsWaitingForTests: number } {
    const { plan, units } = board()
    const beingTested = new Set(this.testers.map((t) => t.task))
    const screens = (plan?.units ?? []).filter((u) => u.kind === "screen" && !this.testsArrived.has(u.id))
    const untestedScreens = screens.filter((u) => {
      const unit = units[u.id]
      return !beingTested.has(u.id) && unit?.status !== "failed" && (unit?.testAttempts ?? 0) < DEFAULTS.maxTestAttempts
    }).length
    const draftsWaitingForTests = screens.filter((u) => units[u.id]?.status === "submitted").length
    return { untestedScreens, draftsWaitingForTests }
  }

  private builderLimit(): number {
    return this.rateLimit ?? board().config.maxBuilders
  }

  // A16: one step down per window; a 429 inside the window means one more step down when it ends.
  private onRateLimited(): void {
    if (this.finished) return
    this.rateLimitedAgain = true
    if (!this.timers.has("rate-limit")) this.lowerBuilderLimit()
  }

  private lowerBuilderLimit(): void {
    const before = this.builderLimit()
    this.rateLimit = Math.max(1, before - 1)
    this.rateLimitedAgain = false
    if (this.rateLimit !== before) log({ agent: "conductor", event: "rate.limited", data: { maxBuilders: this.rateLimit } })
    this.timers.start("rate-limit", DEFAULTS.rateLimitCooldownMs, () => this.enqueue(() => this.onRateLimitWindowEnd()))
    this.dispatch()
  }

  // A quiet window gives one builder back, until the limit is config.maxBuilders again.
  private onRateLimitWindowEnd(): void {
    if (this.finished || this.rateLimit === null) return
    if (this.rateLimitedAgain) return this.lowerBuilderLimit()
    const max = board().config.maxBuilders
    this.rateLimit = Math.min(max, this.rateLimit + 1)
    log({ agent: "conductor", event: "rate.recovered", data: { maxBuilders: this.rateLimit } })
    if (this.rateLimit === max) this.rateLimit = null
    else this.timers.start("rate-limit", DEFAULTS.rateLimitCooldownMs, () => this.enqueue(() => this.onRateLimitWindowEnd()))
    this.dispatch()
  }

  // Without a plan nothing can be built: no new analyzer or architect; the run ends once the busy ones are back.
  private endBeforePlan(): Promise<void> | void {
    if ([...this.analyzers, ...this.architects].some((w) => w.task !== null)) return
    return this.finish("budget.exceeded", "the budget ran out before the plan")
  }

  // P11 + D-024: every next model call would be refused, so building units fail now instead of waiting
  // for their timeouts. Submitted drafts are still checked (no model); the Gatekeeper stops waiting for
  // tests that will not come.
  private stopForBudget(): void {
    for (const builder of this.builders.filter((b) => b.task !== null)) {
      const unitId = builder.task!
      if (board().units[unitId]?.status !== "building") continue
      this.timers.clear(`build:${unitId}`)
      builder.handle.cancel("budget exceeded")
      this.failUnit(unitId, "budget exceeded")
    }
    for (const tester of this.testers.filter((t) => t.task !== null)) {
      if (tester.task!.startsWith(FLOW)) {
        this.flowsTesting.delete(tester.task!.slice(FLOW.length))
        this.flowsSettled.add(tester.task!.slice(FLOW.length))
      }
      this.timers.clear(`tests:${tester.task}`)
      tester.handle.cancel("budget exceeded")
      this.release(tester)
    }
    for (const [unitId, unit] of Object.entries(board().units)) {
      if (unit.status === "submitted" && !this.testsArrived.has(unitId)) emit("tests.missing", { unitId }, this.participant.getId())
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
    // A run where the budget ran out says so, even when every unit got a final status.
    if (isFinished(this.view())) {
      if (!this.flowsPending()) return this.finish(this.budgetExceeded ? "budget.exceeded" : "finished")
      this.timers.start("flows", DEFAULTS.idleCheckMs, () => this.enqueue(() => this.checkFinished()))
      return
    }
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
    this.timers.clearAll()
    this.rescaler.stop()
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
    if (worker.kind === "tester") this.timers.start(`tests:${label}`, DEFAULTS.testsWaitTimeoutMs, () => this.enqueue(() => this.onTestsTimeout(label)))
    if (worker.kind === "builder") this.timers.start(`build:${label}`, DEFAULTS.builderRoundTimeoutMs, () => this.enqueue(() => this.onBuildTimeout(label)))
    this.handOver(worker, task, label)
  }

  // A cancelled loop only stops at its next step, so a new task waits until the agent is really idle.
  private handOver<T>(worker: Worker<T>, task: T, label: string): void {
    if (this.finished || worker.task !== label) return
    if (worker.handle.isBusy()) {
      this.timers.start(`idle:${worker.handle.id}`, DEFAULTS.idleCheckMs, () => this.enqueue(() => this.handOver(worker, task, label)))
      return
    }
    log({ agent: "conductor", event: "task.assigned", data: { to: worker.handle.id, task } })
    worker.handle.assign(task)
    if (worker.kind === "tester") {
      this.timers.start(`watch:${worker.handle.id}`, DEFAULTS.idleCheckMs, () => this.enqueue(() => this.watchTester(worker, label)))
    }
  }

  private release(worker: AnyWorker): void {
    this.timers.clear(`watch:${worker.handle.id}`)
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

// A tester's task label: the unit ID for a screen, this prefix plus the flow ID for a flow.
const FLOW = "flow:"
const flowLabel = (flowId: string): string => `${FLOW}${flowId}`

const isIdle = (worker: AnyWorker): boolean => worker.task === null && !worker.handle.isBusy()

// Going down only stops idle agents, so busy ones keep the count above the target.
function reachable(workers: AnyWorker[], target: number): number {
  return Math.max(target, workers.length - workers.filter(isIdle).length)
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
