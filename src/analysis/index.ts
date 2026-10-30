import type { ValidatePlan } from "../contracts"

// Public API of analysis/ (owner: D). Signatures come from contracts/api.ts.

export { parseApp } from "./parse"
export { splitParts } from "./split"
export { UnsupportedInputError, type UnsupportedInputCode } from "./errors"

export const validatePlan: ValidatePlan = () => {
  throw new Error("not implemented: validatePlan")
}
