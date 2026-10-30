import type { IntentionalDifference } from "./difference"
import type { Scenario } from "./scenario"
import type {
  AnalysisPart,
  Coverage,
  GateResult,
  InteractiveElement,
  ParsedApp,
  Plan,
  ScenarioResult,
  ScreenStatus,
  Unit,
} from "./types"

// Signatures of public domain functions (tim-plan.md §1). Each domain index.ts exports
// `export const name: Type = ...` so tsc catches any drift from these contracts.

// D: analysis/, report/
export type ParseApp = (webDir: string) => Promise<ParsedApp>
export type SplitParts = (parsed: ParsedApp, n: number) => AnalysisPart[]
/** Returns a list of errors; empty means the plan is valid. */
export type ValidatePlan = (plan: Plan, parsed: ParsedApp) => string[]
/** Returns the path to report.html. */
export type BuildReport = (runDir: string) => Promise<string>

// B: scenarios/, verify/
export type Viewport = { width: number; height: number }
export type RunScenariosOptions = { viewport: Viewport; differences: IntentionalDifference[] }
export type RunScenarios = (
  baseUrl: string,
  scenarios: Scenario[],
  opts: RunScenariosOptions,
) => Promise<ScenarioResult[]>
export type ScenarioValidation = { ok: boolean; reason?: string }
export type ValidateScenario = (
  originalUrl: string,
  blankUrl: string,
  scenario: Scenario,
) => Promise<ScenarioValidation>
export type ExtractInteractive = (url: string, route: string) => Promise<InteractiveElement[]>
export type ComputeCoverage = (unit: Unit, scenarios: Scenario[], interactive: InteractiveElement[]) => Coverage
export type VerifyResult = { ok: boolean; results: Record<string, ScenarioResult[]> }
export type Verify = (runDir: string) => Promise<VerifyResult>
export type Sabotage = (runDir: string, unitId: string) => Promise<void>

// C: scaffold/, gatekeeper/
export type Scaffold = (plan: Plan, outDir: string) => Promise<void>
/** Everything the Gatekeeper needs for one draft (D-015): `round` goes into every GateResult,
 *  `unit.sources` (resolved against `webDir`) feed gate 4, `unit.intentionalDifferences` feed gate 5. */
export type CheckDraftInput = { unit: Unit; round: number; draftDir: string; tests: Scenario[]; webDir: string }
export type CheckDraft = (input: CheckDraftInput) => Promise<GateResult[]>
export type Promote = (unitId: string, draftDir: string) => Promise<void>
export type Rollback = (unitId: string) => Promise<void>
export type ServedApp = { url: string; close: () => Promise<void> }
export type ServeApp = (appDir: string) => Promise<ServedApp>
export type StatusInput = {
  tests: Scenario[]
  results: ScenarioResult[]
  coverage: Coverage | null
  /** Not used by computeStatus (C1.6); optional until C drops it from its tests, then removed (D-015). */
  roundsExhausted?: boolean
}
export type ComputeStatus = (input: StatusInput) => ScreenStatus
