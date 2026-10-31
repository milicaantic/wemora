import { RuntimeState } from "@mozaik-ai/core"
import type {
  AgentInfo,
  AnalyzerReport,
  Coverage,
  FlowResult,
  LedgerEntry,
  MigrationStateFields,
  ParsedApp,
  Plan,
  RunConfig,
  Scenario,
  ScreenStatus,
  UnitResult,
  UnitState,
} from "../contracts"

// The shared board (architecture.md §6): contract fields on top of Mozaik's RuntimeState (decision D-003).
export class MigrationState extends RuntimeState implements MigrationStateFields {
  parsed: ParsedApp | null = null
  reports: Record<string, AnalyzerReport[]> = {}
  plan: Plan | null = null
  units: Record<string, UnitState> = {}
  tests: Record<string, Scenario[]> = {}
  results: Record<string, UnitResult> = {}
  coverage: Record<string, Coverage> = {}
  statuses: Record<string, ScreenStatus> = {}
  flowTests: Record<string, Scenario[]> = {}
  flowResults: Record<string, FlowResult> = {}
  agents: Record<string, AgentInfo> = {}
  ledger: Record<string, LedgerEntry> = {}

  constructor(
    readonly runId: string,
    readonly config: RunConfig,
  ) {
    super()
  }
}

export function createInitialState(runId: string, config: RunConfig): MigrationState {
  return new MigrationState(runId, config)
}
