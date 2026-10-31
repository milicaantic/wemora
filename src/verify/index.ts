// Public API of verify/ (owner: B). Signatures come from contracts/api.ts.

export { verify } from "./verify"
// For the CLI (A18): the details and the screen × test matrix it prints.
export { formatVerifyReport, verifyDetailed, type UnitCheck, type VerifyDetails } from "./verify"
export { sabotage } from "./sabotage"
// For the CLI (A18): what was changed, to print it.
export { SABOTAGE_MARK, sabotageDetailed, type SabotageChange } from "./sabotage"
