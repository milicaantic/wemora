import { z } from "zod"

// Event names and payloads (architecture.md §5). Payloads carry only IDs; data lives on the board and on disk.

export const EVENTS = {
  analysisDone: "analysis.done",
  planReady: "plan.ready",
  testsReady: "tests.ready",
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
  "tests.ready": z.strictObject({ unitId: id }),
  "draft.submitted": z.strictObject({ unitId: id, round }),
  "gate.failed": z.strictObject({ unitId: id, round }),
  "unit.promoted": z.strictObject({ unitId: id }),
  "budget.exceeded": z.strictObject({}),
} satisfies Record<EventName, z.ZodType>

export type EventPayloads = { [E in EventName]: z.infer<(typeof EventPayloadSchemas)[E]> }
