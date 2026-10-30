import type { SplitParts, ValidatePlan } from "../contracts"

// Public API of analysis/ (owner: D). Signatures come from contracts/api.ts.

export { parseApp } from "./parse"
export { UnsupportedInputError, type UnsupportedInputCode } from "./errors"

export const splitParts: SplitParts = () => {
  throw new Error("not implemented: splitParts")
}

export const validatePlan: ValidatePlan = () => {
  throw new Error("not implemented: validatePlan")
}
