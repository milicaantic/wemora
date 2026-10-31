import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createHuman, SituationSpecification, type Participant, type SituationContext } from "@mozaik-ai/core"
import { EVENTS, type CheckDraft, type Flow, type FlowResult, type GateResult, type Scenario, type ScreenStatus, type Unit, type UnitResult } from "../contracts"
import { log } from "../core/log"
import { board, emit } from "../core/runtime"
import { checkDraft as realCheckDraft, checkFlow as realCheckFlow, computeStatus, type CheckFlow } from "../gatekeeper"

// Gatekeeper-učesnik (C2.4, architecture.md §10): deterministički, bez modela.
// - draft.submitted → red čekanja; nacrti se proveravaju jedan po jedan (checkDraft)
// - ekran čeka DOGAĐAJ tests.ready ("bez testova nema zelenog"), ne samo testove na tabli: tester ih
//   upisuje jedan po jedan, pa bi provera pre tests.ready uzela nepotpun skup; na tests.missing
//   (Conductor, D-016) ide na proveru bez testova i ulazi kao unproven
// - nacrt iz ranije runde (zakasneli, D-016) se ignoriše
// - rezultat ide na tablu i u results/<unitId>.json, pa gate.failed { unitId, round } ili unit.promoted { unitId }
// - testovi toka (C3.3, D-022): kad su sve jedinice toka promovisane i stigao je flow.tests.ready, tok ide u isti
//   red; rezultat ide u flowResults i results/flows/<flowId>.json. Tok koji pada ne vraća nijedan ekran.

export type GatekeeperOptions = {
  checkDraft?: CheckDraft
  checkFlow?: CheckFlow
}

type Job = { unitId: string; round: number; builderId: string }
// Nacrti i tokovi idu kroz isti red: oba koriste isti app/, pa ne smeju da se preklapaju.
type Work = { kind: "draft"; job: Job } | { kind: "flow"; flowId: string }

class EventOfType extends SituationSpecification {
  constructor(private readonly type: string) {
    super()
  }
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === this.type
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

export function createGatekeeper(id: string, options: GatekeeperOptions = {}): Participant {
  const check = options.checkDraft ?? realCheckDraft
  const checkFlow = options.checkFlow ?? realCheckFlow

  const queue: Work[] = []
  // Ekrani čiji je nacrt stigao pre testova: čekaju tests.ready ili tests.missing.
  const waiting = new Map<string, Job>()
  // Ekrani za koje je stigao tests.ready: tek tada su testovi na tabli potpuni.
  const ready = new Set<string>()
  // Ekrani za koje testova neće biti (tests.missing): proveravaju se bez testova.
  const missing = new Set<string>()
  // Za testove toka: promovisane jedinice, tokovi sa testovima i tokovi koji su već pušteni.
  const promoted = new Set<string>()
  const flowsWithTests = new Set<string>()
  const flowsStarted = new Set<string>()
  let working = false

  const participant: Participant = createHuman({
    name: id,
    capabilities: ["gatekeeper"],
    handlers: [
      {
        specification: new EventOfType(EVENTS.draftSubmitted),
        processor: { apply: ({ event }) => safely(() => onDraft(event.payload as { unitId: string; round: number }, event.producerId)) },
      },
      {
        specification: new EventOfType(EVENTS.testsReady),
        processor: { apply: ({ event }) => safely(() => onTestsReady((event.payload as { unitId: string }).unitId)) },
      },
      {
        specification: new EventOfType(EVENTS.testsMissing),
        processor: { apply: ({ event }) => safely(() => onTestsMissing((event.payload as { unitId: string }).unitId)) },
      },
      {
        specification: new EventOfType(EVENTS.flowTestsReady),
        processor: { apply: ({ event }) => safely(() => onFlowTestsReady((event.payload as { flowId: string }).flowId)) },
      },
    ],
  })

  function safely(work: () => void): void {
    try {
      work()
    } catch (error) {
      log({ agent: id, event: "gatekeeper.handler_failed", data: { error: message(error) } })
    }
  }

  function unitOf(unitId: string): Unit {
    const unit = board().plan?.units.find((u) => u.id === unitId)
    if (!unit) throw new Error(`jedinica "${unitId}" nije u planu`)
    return unit
  }

  /** Runda koju Conductor trenutno vodi; nacrt iz ranije runde je zakasneo (D-016). */
  const isStale = (unitId: string, round: number) => {
    const current = board().units[unitId]?.round
    return current !== undefined && round !== current
  }

  function onDraft({ unitId, round }: { unitId: string; round: number }, producerId: string): void {
    if (isStale(unitId, round)) {
      log({ agent: id, event: "event.stale", data: { unitId, round, current: board().units[unitId]?.round } })
      return
    }
    // builderId sa table (Conductor ga upisuje; ime agenta = ime njegovog staging foldera)
    const builderId = board().units[unitId]?.builderId ?? producerId
    const job: Job = { unitId, round, builderId }
    let unit: Unit
    try {
      unit = unitOf(unitId)
    } catch (error) {
      return void finish(job, [gate(job, "parse", false, `Gatekeeper: ${message(error)}`)], [])
    }
    if (unit.kind === "screen" && !ready.has(unitId) && !missing.has(unitId)) {
      waiting.set(unitId, job)
      log({ agent: id, event: "gatekeeper.waiting_for_tests", data: { unitId, round } })
      return
    }
    enqueue(job)
  }

  function release(unitId: string): void {
    const job = waiting.get(unitId)
    if (!job) return
    waiting.delete(unitId)
    enqueue(job)
  }

  function onTestsReady(unitId: string): void {
    ready.add(unitId)
    release(unitId)
  }

  function onTestsMissing(unitId: string): void {
    missing.add(unitId)
    log({ agent: id, event: "gatekeeper.tests_missing", data: { unitId, waiting: waiting.has(unitId) } })
    release(unitId)
  }

  function enqueue(job: Job): void {
    queue.push({ kind: "draft", job })
    void drain()
  }

  function onFlowTestsReady(flowId: string): void {
    flowsWithTests.add(flowId)
    queueReadyFlows()
  }

  /** Tok ide na proveru jednom: kad ima testove i kad su sve njegove jedinice promovisane. */
  function queueReadyFlows(): void {
    for (const flow of board().plan?.flows ?? []) {
      if (flowsStarted.has(flow.id) || !flowsWithTests.has(flow.id)) continue
      if (!flow.unitIds.every((u) => promoted.has(u))) continue
      flowsStarted.add(flow.id)
      queue.push({ kind: "flow", flowId: flow.id })
    }
    void drain()
  }

  // Jedan nacrt odjednom: app/ je jedan, a promote/rollback nad njim ne smeju da se preklapaju.
  async function drain(): Promise<void> {
    if (working) return
    working = true
    try {
      while (queue.length > 0) {
        const work = queue.shift()!
        if (work.kind === "flow") {
          await runFlow(work.flowId).catch((error) => {
            log({ agent: id, event: "gatekeeper.flow_failed", data: { flowId: work.flowId, error: message(error) } })
          })
          continue
        }
        const job = work.job
        await runOne(job).catch((error) => {
          finish(job, [gate(job, "parse", false, `Gatekeeper: provera nije uspela: ${message(error)}`)], [])
        })
      }
    } finally {
      working = false
    }
  }

  async function runOne(job: Job): Promise<void> {
    // Dok je čekao u redu, Conductor je možda prešao na sledeću rundu.
    if (isStale(job.unitId, job.round)) {
      log({ agent: id, event: "event.stale", data: { unitId: job.unitId, round: job.round } })
      return
    }
    const unit = unitOf(job.unitId)
    const tests = board().tests[job.unitId] ?? []
    const { runDir, webDir } = board().config
    const draftDir = path.join(runDir, "staging", job.builderId, job.unitId)
    log({ agent: id, event: "gatekeeper.check_started", data: { unitId: job.unitId, round: job.round } })
    const gates = await check({ unit, round: job.round, draftDir, tests, webDir })
    finish(job, gates, tests)
  }

  async function runFlow(flowId: string): Promise<void> {
    const plan = board().plan
    const flow: Flow | undefined = plan?.flows.find((f) => f.id === flowId)
    if (!plan || !flow) throw new Error(`tok "${flowId}" nije u planu`)
    const tests = board().flowTests[flowId] ?? []
    const differences = plan.units.filter((u) => flow.unitIds.includes(u.id)).flatMap((u) => u.intentionalDifferences)
    log({ agent: id, event: "gatekeeper.flow_started", data: { flowId, tests: tests.length } })
    const result: FlowResult = await checkFlow({ flow, tests, appDir: path.join(board().config.runDir, "app"), differences })
    // Samo zapis: tok koji pada ne vraća ekrane (D-022), pa nema događaja za Conductor.
    board().flowResults[flowId] = result
    try {
      const dir = path.join(board().config.runDir, "results", "flows")
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, `${flowId}.json`), `${JSON.stringify(result, null, 2)}\n`)
    } catch (error) {
      log({ agent: id, event: "gatekeeper.write_failed", data: { flowId, error: message(error) } })
    }
    log({ agent: id, event: "gatekeeper.flow_checked", data: { flowId, ok: result.ok } })
  }

  function gate(job: Job, name: GateResult["gate"], ok: boolean, msg: string): GateResult {
    return { unitId: job.unitId, round: job.round, gate: name, ok, message: msg }
  }

  /** Prvo tabla i disk, pa događaj: Conductor čita tablu čim događaj stigne. */
  function finish(job: Job, gates: GateResult[], tests: Scenario[]): void {
    const passed = gates.length > 0 && gates.every((g) => g.ok)
    const failed = gates.find((g) => !g.ok)
    // Kapija 5 je prošla, pa je svaki test prošao; nula testova (tests.missing) → unproven.
    const status: ScreenStatus = passed
      ? computeStatus({
          tests,
          results: tests.map((t) => ({ scenarioId: t.id, unitId: t.unitId, ok: true, durationMs: 0 })),
          coverage: board().coverage[job.unitId] ?? null,
        })
      : "failed"
    const result: UnitResult = {
      unitId: job.unitId,
      status,
      rounds: job.round,
      gates,
      scenarios: [],
      coverage: board().coverage[job.unitId] ?? null,
      ...(failed ? { reason: `${failed.gate}: ${failed.message.split("\n")[0]}` } : {}),
    }
    try {
      board().results[job.unitId] = result
      const dir = path.join(board().config.runDir, "results")
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, `${job.unitId}.json`), `${JSON.stringify(result, null, 2)}\n`)
    } catch (error) {
      log({ agent: id, event: "gatekeeper.write_failed", data: { unitId: job.unitId, error: message(error) } })
    }
    log({ agent: id, event: passed ? "gatekeeper.promoted" : "gatekeeper.rejected", data: { unitId: job.unitId, round: job.round, status } })
    try {
      if (passed) emit(EVENTS.unitPromoted, { unitId: job.unitId }, participant.getId())
      else emit(EVENTS.gateFailed, { unitId: job.unitId, round: job.round }, participant.getId())
    } catch (error) {
      log({ agent: id, event: "gatekeeper.emit_failed", data: { unitId: job.unitId, error: message(error) } })
    }
    if (passed) {
      promoted.add(job.unitId)
      queueReadyFlows()
    }
  }

  return participant
}
