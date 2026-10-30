import type { Participant } from "@mozaik-ai/core"
import type { AgentKind } from "../../contracts"

// How the Conductor talks to agents (docs/tasks/a.md, P6): B, C and D export factories that return
// an AgentHandle; the Conductor calls assign() and listens for the events from architecture.md §5.

export interface AgentHandle<TTask> {
  readonly id: string
  readonly kind: AgentKind
  readonly participant: Participant
  isBusy(): boolean
  /** Starts the task in the background. Results arrive as events, never as a return value. */
  assign(task: TTask): void
  /** Ends the current loop at its next step (CancelGuard). */
  cancel(reason: string): void
}

export type AnalyzeTask = { partId: string }
export type ArchitectTask = { partIds: string[] }
export type TestTask = { unitId: string }
export type BuildTask = { unitId: string; round: number; model: string; lastError: string | null }
