import type { CheckDraft } from "../contracts"

// Javni API gatekeeper/ (vlasnik: C). Potpisi su u contracts/api.ts.

export { promote, rollback } from "./promote"
export { serveApp } from "./serve"
export { computeStatus } from "./status"
// Kapije 1–4: builderov alat check_draft (C2.2) i prvi deo checkDraft (C2.3).
export { runGates, type GateCheck, type GateInput } from "./gates/index"

export const checkDraft: CheckDraft = async () => {
  throw new Error("not implemented: checkDraft")
}
