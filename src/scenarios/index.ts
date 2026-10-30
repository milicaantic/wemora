import type { ComputeCoverage } from "../contracts"

// Public API of scenarios/ (owner: B). Signatures come from contracts/api.ts.

export { runScenarios } from "./run"
export { validateScenario } from "./validate"
export { extractInteractive } from "./interactive"

export const computeCoverage: ComputeCoverage = () => {
  throw new Error("not implemented: computeCoverage")
}
