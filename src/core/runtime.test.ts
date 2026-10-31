import { createHuman, SituationSpecification, type SemanticEvent, type SituationContext } from "@mozaik-ai/core"
import { beforeAll, describe, expect, it } from "vitest"
import type { RunConfig } from "../contracts"
import { board, emit, initializeRuntime, join, leave } from "./runtime"
import { createInitialState, MigrationState } from "./state"

// The runtime is one per process, so every test in this file shares the one initialized in beforeAll.

const config: RunConfig = {
  webDir: "examples/todomvc",
  runDir: "output/test-run",
  maxBuilders: 4,
  maxTesters: 2,
  budgetUsd: 3,
  mock: true,
}

class AnyEvent extends SituationSpecification {
  isSatisfiedBy(): boolean {
    return true
  }
}

// A deterministic participant that records every event it receives.
function recorder(name: string) {
  const received: SemanticEvent[] = []
  const participant = createHuman({
    name,
    capabilities: [],
    handlers: [{ specification: new AnyEvent(), processor: { apply: ({ event }: SituationContext) => void received.push(event) } }],
  })
  return { participant, received }
}

const state = createInitialState("run-1", config)

beforeAll(() => {
  initializeRuntime({ state })
})

describe("createInitialState", () => {
  it("has every board field from architecture.md §6 with empty values", () => {
    const fresh = createInitialState("run-2", config)
    expect(fresh).toBeInstanceOf(MigrationState)
    expect(fresh).toMatchObject({
      runId: "run-2",
      parsed: null,
      reports: {},
      plan: null,
      units: {},
      tests: {},
      results: {},
      coverage: {},
      statuses: {},
      flowTests: {},
      flowResults: {},
      agents: {},
      ledger: {},
      config,
    })
    expect(fresh.getParticipants()).toEqual([])
  })
})

describe("runtime", () => {
  it("refuses a second initialization", () => {
    expect(() => initializeRuntime({ state: createInitialState("run-3", config) })).toThrow(
      "Runtime already initialized",
    )
  })

  it("exposes the initialized state as the board", () => {
    expect(board()).toBe(state)
  })

  it("delivers an emitted event to every joined participant, including the sender", () => {
    const sender = recorder("sender")
    const other = recorder("other")
    join(sender.participant)
    join(other.participant)

    emit("unit.promoted", { unitId: "u1" }, sender.participant.getId())

    for (const { received } of [sender, other]) {
      const promoted = received.filter((e) => e.type === "unit.promoted")
      expect(promoted).toHaveLength(1)
      expect(promoted[0]).toMatchObject({ producerId: sender.participant.getId(), payload: { unitId: "u1" } })
    }
    leave(sender.participant)
    leave(other.participant)
  })

  it("stops delivering to a participant after leave", () => {
    const sender = recorder("sender")
    const listener = recorder("listener")
    join(sender.participant)
    join(listener.participant)
    leave(listener.participant)

    emit("plan.ready", {}, sender.participant.getId())

    expect(sender.received.some((e) => e.type === "plan.ready")).toBe(true)
    expect(listener.received.some((e) => e.type === "plan.ready")).toBe(false)
    leave(sender.participant)
  })

  it("throws when the sender has not joined (Mozaik checks the sender)", () => {
    expect(() => emit("plan.ready", {}, "nobody")).toThrow("Participant nobody not found")
  })

  it("accepts only contract payloads at compile time", () => {
    // Never called: tsc checks these lines, and each @ts-expect-error fails the build if the line compiles.
    const typeChecks = () => {
      // @ts-expect-error extra data in a payload is not allowed (invariant 5)
      emit("unit.promoted", { unitId: "u1", code: "export default () => null" }, "x")
      // @ts-expect-error unknown event name
      emit("unit.deleted", { unitId: "u1" }, "x")
      // @ts-expect-error wrong payload for this event
      emit("draft.submitted", { unitId: "u1" }, "x")
    }
    expect(typeChecks).toBeTypeOf("function")
  })
})
