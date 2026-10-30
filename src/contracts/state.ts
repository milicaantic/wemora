import type { Scenario } from "./scenario"
import type { AnalyzerReport, Coverage, ParsedApp, Plan, ScreenStatus, UnitResult } from "./types"

// Shape of the shared board (architecture.md §6). core/state.ts implements it on top of Mozaik RuntimeState.

export type UnitStatus = "waiting" | "building" | "submitted" | "promoted" | "failed"

export type UnitState = {
  status: UnitStatus
  round: number
  model: string | null
  builderId: string | null
  testerId: string | null
  testAttempts: number
}

export type AgentKind = "analyzer" | "architect" | "tester" | "builder" | "gatekeeper" | "conductor"

export type AgentInfo = {
  id: string
  kind: AgentKind
  busyWith: string | null
  joinedAt: string
}

export type LedgerEntry = {
  agentId: string
  calls: number
  inputTokens: number
  outputTokens: number
  usd: number
}

export type RunConfig = {
  webDir: string
  runDir: string
  maxBuilders: number
  maxTesters: number
  budgetUsd: number
  mock: boolean
}

// Records (not Maps) so the board can be logged as JSON.
export interface MigrationStateFields {
  runId: string
  parsed: ParsedApp | null
  /** Keyed by partId. */
  reports: Record<string, AnalyzerReport[]>
  plan: Plan | null
  /** Keyed by unitId, as are tests, results, coverage and statuses. */
  units: Record<string, UnitState>
  tests: Record<string, Scenario[]>
  results: Record<string, UnitResult>
  coverage: Record<string, Coverage>
  statuses: Record<string, ScreenStatus>
  /** Keyed by agentId, as is ledger. */
  agents: Record<string, AgentInfo>
  ledger: Record<string, LedgerEntry>
  config: RunConfig
}
