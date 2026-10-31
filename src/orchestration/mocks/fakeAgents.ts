import path from "node:path"
import { createHuman, SemanticEvent, SituationSpecification, type Participant, type SituationContext } from "@mozaik-ai/core"
import type { AgentHandle, AnalyzeTask, ArchitectTask, BuildTask, TestTask } from "../../agents/_shared"
import type { AgentKind, AnalysisPart, ParsedApp, Plan } from "../../contracts"
import { board, emit, sendEvent } from "../../core/runtime"
import type { ConductorDeps } from "../conductor"

// Fake agents and domain functions for Conductor tests: they behave like the real ones from the
// outside (AgentHandle, events, board), with no model and no browser. Replaced by real agents in A12.

export type FakeScript = {
  plan: Plan
  /** How many parts splitParts returns (default: what the Conductor asks for). */
  parts?: number
  /** Per unit: the first N rounds fail the gates (Infinity = never promoted). */
  failRounds?: Record<string, number>
  planFails?: boolean
  /** The Gatekeeper sends budget.exceeded right after this many promotions. */
  budgetAfterPromotions?: number
  /** The analyzer sends an inference.stream event, which the event log must skip. */
  emitStream?: boolean
  parseError?: string
  /** Per screen: the tester's first N attempts send nothing, as if its loop hung (Infinity = always). */
  silentTests?: Record<string, number>
  /** Per unit: the builder's first N rounds submit nothing (Infinity = never). */
  silentRounds?: Record<string, number>
  /** A cancelled agent stays busy for one more tick, like a real loop that stops at its next step. */
  slowCancel?: boolean
  /** The Gatekeeper holds a screen's draft until tests.ready, or promotes it as unproven on tests.missing. */
  waitForTests?: boolean
  /** A cancelled builder still sends draft.submitted for the round it was cancelled in, one tick later. */
  lateDraftOnCancel?: boolean
  /** Per flow: the tester's first N attempts send nothing (Infinity = always). */
  silentFlows?: Record<string, number>
  /** Per screen or flow: the tester's first N attempts end with no tests and no event, like tests.none. */
  emptyTests?: Record<string, number>
}

export type FakeCalls = {
  analyzer: AnalyzeTask[]
  architect: ArchitectTask[]
  /** Screen tasks; flow tasks are in flowTester. */
  tester: Array<{ unitId: string }>
  flowTester: string[]
  /** Flows the Gatekeeper checked, in order. */
  flowChecks: string[]
  builder: Array<BuildTask & { builderId: string }>
  scaffold: number
  buildReport: number
  /** Agents the Conductor cancelled, as "tester-1: <reason>". */
  cancels: string[]
  /** What happened, in order: "analysis.done:p1", "architect", "scaffold", "tester:u1", "builder:u1:1"… */
  order: string[]
}

// Every fake acts on the next tick, like a real agent finishing its loop later.
const later = (work: () => void): void => {
  setTimeout(work, 0)
}

type Act<T> = (task: T, participantId: string) => "silent" | void

type CancelOptions = { slow?: boolean; afterCancel?: (task: unknown, participantId: string) => void }

function fakeHandle<T>(id: string, kind: AgentKind, act: Act<T>, onCancel: (reason: string) => void, options: CancelOptions = {}): AgentHandle<T> {
  let busy = false
  let current: T | null = null
  // Like a real agent (handle.ts): a task cancelled before it acted sends nothing.
  let generation = 0
  const participant = createHuman({ name: id, capabilities: [kind], handlers: [] })
  return {
    id,
    kind,
    participant,
    isBusy: () => busy,
    assign(task) {
      busy = true
      current = task
      const mine = ++generation
      later(() => {
        if (mine !== generation) return
        busy = false
        // A silent task keeps the agent busy until the Conductor cancels it.
        if (act(task, participant.getId()) === "silent") busy = true
      })
    },
    cancel(reason) {
      generation++
      onCancel(`${id}: ${reason}`)
      const cancelled = current
      if (options.slow) later(() => (busy = false))
      else busy = false
      if (options.afterCancel && cancelled !== null) later(() => options.afterCancel?.(cancelled, participant.getId()))
    },
  }
}

class GatekeeperEvents extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return ["draft.submitted", "tests.ready", "tests.missing", "flow.tests.ready"].includes(event.type)
  }
}

export function fakeWorld(script: FakeScript): { deps: ConductorDeps; calls: FakeCalls } {
  const calls: FakeCalls = {
    analyzer: [],
    architect: [],
    tester: [],
    flowTester: [],
    flowChecks: [],
    builder: [],
    scaffold: 0,
    buildReport: 0,
    cancels: [],
    order: [],
  }
  const screens = script.plan.units.filter((u) => u.kind === "screen")
  const testerAttempts = new Map<string, number>()
  const onCancel = (entry: string) => calls.cancels.push(entry)
  let promotions = 0

  function fakeGatekeeper(id: string): Participant {
    const held = new Set<string>()
    const tested = new Set<string>()
    const flowsWithTests = new Set<string>()
    const promoted = new Set<string>()
    // Like C's Gatekeeper: a flow is checked once it has tests and all its units are promoted. The result
    // is on the board before the Conductor hears of the promotion or of the flow's tests.
    const checkFlows = () => {
      for (const flow of script.plan.flows) {
        if (!flowsWithTests.has(flow.id) || board().flowResults[flow.id] || !flow.unitIds.every((u) => promoted.has(u))) continue
        board().flowResults[flow.id] = { flowId: flow.id, ok: true, scenarios: [] }
        calls.flowChecks.push(flow.id)
      }
    }
    const promote = (unitId: string) => {
      promoted.add(unitId)
      checkFlows()
      emit("unit.promoted", { unitId }, gatekeeper.getId())
      if (++promotions === script.budgetAfterPromotions) emit("budget.exceeded", {}, gatekeeper.getId())
    }
    const onDraft = (unitId: string, round: number) => {
      // Like the real Gatekeeper should: a draft from an earlier round comes from a loop that timed out.
      if (round !== board().units[unitId]?.round) return
      if (round <= (script.failRounds?.[unitId] ?? 0)) {
        const message = `missing label "Pretraga" in round ${round}`
        board().results[unitId] = {
          unitId,
          status: "failed",
          rounds: round,
          gates: [{ unitId, round, gate: "labels", ok: false, message }],
          scenarios: [],
          coverage: null,
        }
        emit("gate.failed", { unitId, round }, gatekeeper.getId())
        return
      }
      const isScreen = screens.some((u) => u.id === unitId)
      if (script.waitForTests && isScreen && !tested.has(unitId)) held.add(unitId)
      else promote(unitId)
    }
    const onTests = (unitId: string, missing: boolean) => {
      tested.add(unitId)
      if (missing) board().statuses[unitId] = "unproven"
      if (held.delete(unitId)) promote(unitId)
    }
    const gatekeeper: Participant = createHuman({
      name: id,
      capabilities: ["gatekeeper"],
      handlers: [
        {
          specification: new GatekeeperEvents(),
          processor: {
            apply: ({ event }) => {
              if (event.type === "flow.tests.ready") {
                flowsWithTests.add((event.payload as { flowId: string }).flowId)
                return checkFlows()
              }
              later(() => {
                const { unitId, round } = event.payload as { unitId: string; round?: number }
                if (event.type === "draft.submitted") onDraft(unitId, round ?? 0)
                else onTests(unitId, event.type === "tests.missing")
              })
            },
          },
        },
      ],
    })
    return gatekeeper
  }

  const deps: ConductorDeps = {
    parseApp: async (webDir) => {
      if (script.parseError) throw new Error(script.parseError)
      const routes = screens.map((u) => ({ path: u.route ?? `/${u.id}`, file: `src/${u.id}.jsx`, files: [], tokens: u.size, webApis: [] }))
      return { webDir, routes, sharedFiles: [], totalTokens: 10_000, parts: [] } satisfies ParsedApp
    },
    splitParts: (_parsed, n): AnalysisPart[] =>
      Array.from({ length: script.parts ?? n }, (_, i) => ({ id: `p${i + 1}`, routes: [], files: [], tokens: 0 })),
    scaffold: async () => {
      calls.scaffold++
      calls.order.push("scaffold")
    },
    buildReport: async (runDir) => {
      calls.buildReport++
      return path.join(runDir, "report.html")
    },
    agents: {
      analyzer: (id) =>
        fakeHandle<AnalyzeTask>(id, "analyzer", (task, pid) => {
          calls.analyzer.push(task)
          if (script.emitStream) sendEvent(SemanticEvent.create("inference.stream", pid, { delta: "token" }), pid)
          board().reports[task.partId] = []
          calls.order.push(`analysis.done:${task.partId}`)
          emit("analysis.done", { partId: task.partId }, pid)
        }, onCancel),
      architect: (id) =>
        fakeHandle<ArchitectTask>(id, "architect", (task, pid) => {
          calls.architect.push(task)
          calls.order.push("architect")
          if (script.planFails) return emit("plan.failed", {}, pid)
          board().plan = script.plan
          emit("plan.ready", {}, pid)
        }, onCancel),
      tester: (id) =>
        fakeHandle<TestTask>(
          id,
          "tester",
          (task, pid) => {
            if ("flowId" in task) {
              const { flowId } = task
              calls.flowTester.push(flowId)
              calls.order.push(`flow-tester:${flowId}`)
              const attempt = (testerAttempts.get(`flow:${flowId}`) ?? 0) + 1
              testerAttempts.set(`flow:${flowId}`, attempt)
              if (attempt <= (script.silentFlows?.[flowId] ?? 0)) return "silent"
              if (attempt <= (script.emptyTests?.[flowId] ?? 0)) return
              const first = script.plan.flows.find((f) => f.id === flowId)?.unitIds[0] ?? flowId
              board().flowTests[flowId] = [{ id: `${flowId}-t1`, unitId: first, obligation: flowId, flowId, steps: [{ goto: "/" }] }]
              emit("flow.tests.ready", { flowId }, pid)
              return
            }
            calls.tester.push(task)
            calls.order.push(`tester:${task.unitId}`)
            const attempt = (testerAttempts.get(task.unitId) ?? 0) + 1
            testerAttempts.set(task.unitId, attempt)
            if (attempt <= (script.silentTests?.[task.unitId] ?? 0)) return "silent"
            if (attempt <= (script.emptyTests?.[task.unitId] ?? 0)) return
            board().tests[task.unitId] = [{ id: `${task.unitId}-t1`, unitId: task.unitId, obligation: "o", steps: [{ goto: "/" }] }]
            emit("tests.ready", { unitId: task.unitId }, pid)
          },
          onCancel,
          { slow: script.slowCancel },
        ),
      builder: (id) =>
        fakeHandle<BuildTask>(
          id,
          "builder",
          (task, pid) => {
            calls.builder.push({ ...task, builderId: id })
            calls.order.push(`builder:${task.unitId}:${task.round}`)
            if (task.round <= (script.silentRounds?.[task.unitId] ?? 0)) return "silent"
            emit("draft.submitted", { unitId: task.unitId, round: task.round }, pid)
          },
          onCancel,
          {
            slow: script.slowCancel,
            afterCancel: script.lateDraftOnCancel
              ? (task, pid) => {
                  const { unitId, round } = task as BuildTask
                  emit("draft.submitted", { unitId, round }, pid)
                }
              : undefined,
          },
        ),
      gatekeeper: fakeGatekeeper,
    },
  }
  return { deps, calls }
}
