import type { Participant } from "@mozaik-ai/core"
import type { AgentKind } from "../../contracts"

// How the Conductor talks to agents (docs/tasks/a.md, P6): B, C and D export factories that return
// an AgentHandle; the Conductor calls assign() and listens for the events from architecture.md §5.

/**
 * Rules every agent follows so the Conductor (src/orchestration/conductor.ts) can drive it:
 * - The factory is `createX(id, ...yourDeps)`; the CLI binds your deps, the Conductor passes `id`.
 * - Create the Mozaik agent with `name: id` (the run log and the report show this name).
 * - Do not call `join`: the Conductor joins every agent before its first task.
 * - Send events from your own participant (`emit(type, payload, participant.getId())`).
 * - Write the board (and the file on disk) first, then send the event: the Conductor reads the
 *   board as soon as the event arrives.
 * - One `assign` = one task; a builder task is one round, with the model from `task.model`.
 * - Catch errors inside `assign`; a crashed task sends nothing. For a builder the Conductor only notices at
 *   the timeout; a tester that is no longer busy without its result is noticed within a second (D-028).
 * - A tester becomes idle (`isBusy()` false) in the same step it sends its result, never before a later await.
 * - `cancel` comes after a timeout (A13): end the loop and do not send the result event of that task. The
 *   Conductor ignores a late `draft.submitted`/`gate.failed` from an earlier round, and so must the Gatekeeper.
 * See `src/orchestration/mocks/fakeAgents.ts` for minimal agents that follow these rules.
 */
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
/** A screen, or a flow across screens (D-022), which the Conductor hands out once every screen of it has tests. */
export type TestTask = { unitId: string } | { flowId: string }
export type BuildTask = { unitId: string; round: number; model: string; lastError: string | null }
