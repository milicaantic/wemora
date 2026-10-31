import type { Sabotage } from "../contracts"

// Public API of verify/ (owner: B). Signatures come from contracts/api.ts.

export { verify } from "./verify"
// For the CLI (A18): the details and the screen × test matrix it prints.
export { formatVerifyReport, verifyDetailed, type UnitCheck, type VerifyDetails } from "./verify"

export const sabotage: Sabotage = async () => {
  throw new Error("not implemented: sabotage")
}
