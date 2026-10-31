import { z } from "zod"

// Event names and payloads (architecture.md §5). Payloads carry only IDs; data lives on the board and on disk.

export const EVENTS = {
  analysisDone: "analysis.done",
  planReady: "plan.ready",
  planFailed: "plan.failed",
  testsReady: "tests.ready",
  testsMissing: "tests.missing",
  flowTestsReady: "flow.tests.ready",
  draftSubmitted: "draft.submitted",
  gateFailed: "gate.failed",
  unitPromoted: "unit.promoted",
  budgetExceeded: "budget.exceeded",
} as const

export const MOZAIK_EVENTS = {
  participantJoined: "participant.joined",
  participantLeft: "participant.left",
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]

const id = z.string().min(1)
const round = z.number().int().positive()

export const EventPayloadSchemas = {
  "analysis.done": z.strictObject({ partId: id }),
  "plan.ready": z.strictObject({}),
  // The architect gave up after its retries (D-012); the Conductor ends the run.
  "plan.failed": z.strictObject({}),
  "tests.ready": z.strictObject({ unitId: id }),
  // Two testers in a row timed out on this screen; the Gatekeeper promotes it as unproven (D-016).
  "tests.missing": z.strictObject({ unitId: id }),
  // The flow's tests are on the board (flowTests) and in tests/flows/<flowId>.json (D-022).
  "flow.tests.ready": z.strictObject({ flowId: id }),
  "draft.submitted": z.strictObject({ unitId: id, round }),
  "gate.failed": z.strictObject({ unitId: id, round }),
  "unit.promoted": z.strictObject({ unitId: id }),
  "budget.exceeded": z.strictObject({}),
} satisfies Record<EventName, z.ZodType>

export type EventPayloads = { [E in EventName]: z.infer<(typeof EventPayloadSchemas)[E]> }
