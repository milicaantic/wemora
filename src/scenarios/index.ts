import type { ComputeCoverage, ExtractInteractive, RunScenarios, ValidateScenario } from "../contracts"

// Public API of scenarios/ (owner: B). Placeholders until F1; signatures come from contracts/api.ts.

export const runScenarios: RunScenarios = async () => {
  throw new Error("not implemented: runScenarios")
}

export const validateScenario: ValidateScenario = async () => {
  throw new Error("not implemented: validateScenario")
}

export const extractInteractive: ExtractInteractive = async () => {
  throw new Error("not implemented: extractInteractive")
}

export const computeCoverage: ComputeCoverage = () => {
  throw new Error("not implemented: computeCoverage")
}
