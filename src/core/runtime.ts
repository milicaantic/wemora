import { defineRuntime, SemanticEvent } from "@mozaik-ai/core"
import type { EventName, EventPayloads } from "../contracts"
import type { MigrationState } from "./state"

// The only defineRuntime call in the project: Mozaik allows one runtime per process.
export const {
  initializeRuntime,
  resolveRuntime,
  resolveParticipant,
  join,
  leave,
  sendMessage,
  sendEvent,
  runLoop,
} = defineRuntime<MigrationState>()

export function board(): MigrationState {
  return resolveRuntime().state
}

// Sends one of our events. The payload type comes from contracts/events.ts, so only IDs can be sent.
// Mozaik throws if senderId has not joined the runtime.
export function emit<E extends EventName>(type: E, payload: EventPayloads[E], senderId: string): void {
  sendEvent(SemanticEvent.create(type, senderId, payload), senderId)
}
