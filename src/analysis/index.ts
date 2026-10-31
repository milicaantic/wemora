// Public API of analysis/ (owner: D). Signatures come from contracts/api.ts.

export { parseApp } from "./parse"
export { splitParts } from "./split"
export { validatePlan } from "./validatePlan"
export { UnsupportedInputError, type UnsupportedInputCode } from "./errors"

// Used by the analyzer agent (agents/analyzer.ts); the rules live here so they are tested without Mozaik.
export { createFileAccess, allowedFiles, MAX_FILE_CHARS, type FileAccess } from "./fileAccess"
export { analyzerBrief } from "./analyzerBrief"
export {
  AnalyzerOutputSchema,
  ModelReportSchema,
  analyzerOutputSchema,
  finalizeReports,
  fallbackReports,
  routeProblems,
  type AnalyzerOutput,
  type ModelReport,
} from "./reports"

// Used by the architect agent (agents/architect.ts).
export { expoRouteFor } from "./expoRoute"
export { ArchitectOutputSchema, normalizePlan, type ArchitectOutput } from "./normalizePlan"
export { architectBrief, architectRetryMessage } from "./architectBrief"
export { THEME_UNIT } from "./normalizePlan"
export { globalStylesheets, hasGlobalRules, knownSourceFiles, packageStylesheets } from "./styles"
