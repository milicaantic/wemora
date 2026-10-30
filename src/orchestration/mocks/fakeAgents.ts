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
}

export type FakeCalls = {
  analyzer: AnalyzeTask[]
  architect: ArchitectTask[]
  tester: TestTask[]
  builder: Array<BuildTask & { builderId: string }>
  scaffold: number
  buildReport: number
  /** What happened, in order: "analysis.done:p1", "architect", "scaffold", "tester:u1", "builder:u1:1"… */
  order: string[]
}

// Every fake acts on the next tick, like a real agent finishing its loop later.
const later = (work: () => void): void => {
  setTimeout(work, 0)
}

function fakeHandle<T>(id: string, kind: AgentKind, act: (task: T, participantId: string) => void): AgentHandle<T> {
  let busy = false
  const participant = createHuman({ name: id, capabilities: [kind], handlers: [] })
  return {
    id,
    kind,
    participant,
    isBusy: () => busy,
    assign(task) {
      busy = true
      later(() => {
        busy = false
        act(task, participant.getId())
      })
    },
    cancel() {},
  }
}

class DraftSubmitted extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "draft.submitted"
  }
}

export function fakeWorld(script: FakeScript): { deps: ConductorDeps; calls: FakeCalls } {
  const calls: FakeCalls = { analyzer: [], architect: [], tester: [], builder: [], scaffold: 0, buildReport: 0, order: [] }
  const screens = script.plan.units.filter((u) => u.kind === "screen")
  let promotions = 0

  function fakeGatekeeper(id: string): Participant {
    const gatekeeper: Participant = createHuman({
      name: id,
      capabilities: ["gatekeeper"],
      handlers: [
        {
          specification: new DraftSubmitted(),
          processor: {
            apply: ({ event }) =>
              later(() => {
                const { unitId, round } = event.payload as { unitId: string; round: number }
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
                emit("unit.promoted", { unitId }, gatekeeper.getId())
                if (++promotions === script.budgetAfterPromotions) emit("budget.exceeded", {}, gatekeeper.getId())
              }),
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
        }),
      architect: (id) =>
        fakeHandle<ArchitectTask>(id, "architect", (task, pid) => {
          calls.architect.push(task)
          calls.order.push("architect")
          if (script.planFails) return emit("plan.failed", {}, pid)
          board().plan = script.plan
          emit("plan.ready", {}, pid)
        }),
      tester: (id) =>
        fakeHandle<TestTask>(id, "tester", (task, pid) => {
          calls.tester.push(task)
          calls.order.push(`tester:${task.unitId}`)
          board().tests[task.unitId] = [{ id: `${task.unitId}-t1`, unitId: task.unitId, obligation: "o", steps: [{ goto: "/" }] }]
          emit("tests.ready", { unitId: task.unitId }, pid)
        }),
      builder: (id) =>
        fakeHandle<BuildTask>(id, "builder", (task, pid) => {
          calls.builder.push({ ...task, builderId: id })
          calls.order.push(`builder:${task.unitId}:${task.round}`)
          emit("draft.submitted", { unitId: task.unitId, round: task.round }, pid)
        }),
      gatekeeper: fakeGatekeeper,
    },
  }
  return { deps, calls }
}
