import { createHuman, SituationSpecification, type Participant, type SemanticEvent, type SituationContext } from "@mozaik-ai/core"
import { EVENTS } from "../contracts"
import { log } from "../core/log"
import { resolveRuntime } from "../core/runtime"

// Writes every runtime event to run.jsonl (the report's timeline), except inference.stream, which is
// one event per token. `agent` is the participant's name (e.g. "builder-1"), not Mozaik's UUID.

const OUR_EVENTS = new Set<string>(Object.values(EVENTS))

class EveryEventButStream extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type !== "inference.stream"
  }
}

export function createEventLogger(): Participant {
  return createHuman({
    name: "event-logger",
    capabilities: ["log"],
    handlers: [
      {
        specification: new EveryEventButStream(),
        processor: { apply: ({ event }) => log({ agent: agentName(event), event: event.type, data: summarize(event) }) },
      },
    ],
  })
}

// participant.left arrives after the participant is gone, so its name comes from the payload (the manifest).
function agentName(event: SemanticEvent): string {
  const manifestName = (event.payload as { name?: unknown } | null)?.name
  if (event.type.startsWith("participant.") && typeof manifestName === "string") return manifestName
  try {
    return resolveRuntime().getParticipant(event.producerId)?.getManifest().name ?? event.producerId
  } catch {
    return event.producerId
  }
}

// Loop payloads carry the whole model context, so only small fields go to the log.
// Each event type has its own payload shape, so fields are read loosely here.
function summarize(event: SemanticEvent): unknown {
  const p = (event.payload ?? {}) as Record<string, any>
  if (OUR_EVENTS.has(event.type)) return { ...(event.payload as object), producerId: event.producerId }
  switch (event.type) {
    case "participant.joined":
    case "participant.left":
      return { id: p.id, name: p.name, role: p.role }
    case "inference.started":
      return { loopId: p.loopId, model: p.model }
    case "inference.completed":
      return { loopId: p.loopId, inputTokens: p.tokenUsage?.inputTokens, outputTokens: p.tokenUsage?.outputTokens }
    case "function_call.started":
      return { loopId: p.loopId, tool: p.call?.name }
    case "model.answer":
      return { loopId: p.loopId, text: String(p.answer?.content?.text ?? "").slice(0, 300) }
    default:
      return { loopId: p.loopId }
  }
}
