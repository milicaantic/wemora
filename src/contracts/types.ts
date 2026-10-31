import { z } from "zod"
import { IntentionalDifferenceSchema } from "./difference"

const id = z.string().min(1)

// Parser output (architecture.md §3).

export const ParsedRouteSchema = z.strictObject({
  path: z.string().min(1),
  file: z.string().min(1),
  files: z.array(z.string()),
  tokens: z.number().int().nonnegative(),
  webApis: z.array(z.string()),
})
export type ParsedRoute = z.infer<typeof ParsedRouteSchema>

export const AnalysisPartSchema = z.strictObject({
  id,
  routes: z.array(z.string()),
  files: z.array(z.string()),
  tokens: z.number().int().nonnegative(),
})
export type AnalysisPart = z.infer<typeof AnalysisPartSchema>

export const ParsedAppSchema = z.strictObject({
  webDir: z.string().min(1),
  routes: z.array(ParsedRouteSchema),
  sharedFiles: z.array(z.string()),
  totalTokens: z.number().int().nonnegative(),
  parts: z.array(AnalysisPartSchema),
})
export type ParsedApp = z.infer<typeof ParsedAppSchema>

// Analyzer output: one report per screen.

export const AnalyzerReportSchema = z.strictObject({
  partId: id,
  route: z.string().min(1),
  screen: z.string().min(1),
  summary: z.string(),
  files: z.array(z.string()),
  components: z.array(z.string()),
  dataSources: z.array(z.string()),
  navigatesTo: z.array(z.string()),
  webApis: z.array(z.string()),
  mobileIssues: z.array(z.string()),
  suggestedObligations: z.array(z.string()),
})
export type AnalyzerReport = z.infer<typeof AnalyzerReportSchema>

// Plan and unit of work (architecture.md §8).

export const ObligationSchema = z.strictObject({ id, description: z.string().min(1) })
export type Obligation = z.infer<typeof ObligationSchema>

export const UnitSchema = z.strictObject({
  id,
  kind: z.enum(["shared", "screen"]),
  wave: z.number().int().nonnegative(),
  route: z.string().min(1).optional(),
  sources: z.array(z.string()),
  writes: z.array(z.string()),
  dependsOn: z.array(id),
  obligations: z.array(ObligationSchema),
  intentionalDifferences: z.array(IntentionalDifferenceSchema),
  // Size in tokens.
  size: z.number().int().nonnegative(),
})
export type Unit = z.infer<typeof UnitSchema>

export const FlowSchema = z.strictObject({
  id,
  description: z.string().min(1),
  unitIds: z.array(id).min(2),
})
export type Flow = z.infer<typeof FlowSchema>

export const PlanSchema = z.strictObject({
  units: z.array(UnitSchema).min(1),
  flows: z.array(FlowSchema),
  // Web path → Expo Router path.
  routeMap: z.record(z.string(), z.string()),
})
export type Plan = z.infer<typeof PlanSchema>

// Verification results (architecture.md §10).

export const ScreenStatusSchema = z.enum(["proven", "partial", "unproven", "failed"])
export type ScreenStatus = z.infer<typeof ScreenStatusSchema>

export const GateNameSchema = z.enum([
  "parse",
  "forbiddenApis",
  "tsc",
  "labels",
  "scenarios",
  "androidExport",
  "regression",
])
export type GateName = z.infer<typeof GateNameSchema>

export const GateResultSchema = z.strictObject({
  unitId: id,
  round: z.number().int().positive(),
  gate: GateNameSchema,
  ok: z.boolean(),
  message: z.string(),
  brokenTests: z.array(z.string()).optional(),
})
export type GateResult = z.infer<typeof GateResultSchema>

export const ScenarioResultSchema = z.strictObject({
  scenarioId: id,
  unitId: id,
  ok: z.boolean(),
  failedStep: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative(),
})
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>

export const InteractiveElementSchema = z.strictObject({
  role: z.string().min(1),
  name: z.string().min(1),
})
export type InteractiveElement = z.infer<typeof InteractiveElementSchema>

export const CoverageSchema = z.strictObject({
  unitId: id,
  obligations: z.strictObject({ covered: z.array(z.string()), missing: z.array(z.string()) }),
  elements: z.strictObject({
    covered: z.array(InteractiveElementSchema),
    missing: z.array(InteractiveElementSchema),
    notPortable: z.array(InteractiveElementSchema),
  }),
})
export type Coverage = z.infer<typeof CoverageSchema>

// Contents of results/<unitId>.json.
export const UnitResultSchema = z.strictObject({
  unitId: id,
  status: ScreenStatusSchema,
  rounds: z.number().int().nonnegative(),
  gates: z.array(GateResultSchema),
  scenarios: z.array(ScenarioResultSchema),
  coverage: CoverageSchema.nullable(),
  reason: z.string().optional(),
})
export type UnitResult = z.infer<typeof UnitResultSchema>

// results/flows/<flowId>.json (D-022). A failing flow is only reported; it rolls back no unit.
export const FlowResultSchema = z.strictObject({
  flowId: id,
  ok: z.boolean(),
  scenarios: z.array(ScenarioResultSchema),
})
export type FlowResult = z.infer<typeof FlowResultSchema>
