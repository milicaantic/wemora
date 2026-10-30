import type { ComputeCoverage, ExtractInteractive, ValidateScenario } from "../contracts"

// Public API of scenarios/ (owner: B). Signatures come from contracts/api.ts.

export { runScenarios } from "./run"

export const validateScenario: ValidateScenario = async () => {
  throw new Error("not implemented: validateScenario")
}

export const extractInteractive: ExtractInteractive = async () => {
  throw new Error("not implemented: extractInteractive")
}

export const computeCoverage: ComputeCoverage = () => {
  throw new Error("not implemented: computeCoverage")
}
