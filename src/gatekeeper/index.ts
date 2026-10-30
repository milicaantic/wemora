import type { CheckDraft } from "../contracts"
import { runScenarios } from "../scenarios/index"
import { createCheckDraft } from "./check"
import { serveApp } from "./serve"

// Javni API gatekeeper/ (vlasnik: C). Potpisi su u contracts/api.ts.

export { promote, rollback } from "./promote"
export { serveApp } from "./serve"
export { computeStatus } from "./status"
// Kapije 1–4: builderov alat check_draft (C2.2) i prvi deo checkDraft (C2.3).
export { runGates, type GateCheck, type GateInput } from "./gates/index"
export { createCheckDraft, PHONE, type CheckDraftDeps } from "./check"

/** Ceo put nacrta (C2.3), sa B-ovim runScenarios i pravim web exportom. */
export const checkDraft: CheckDraft = createCheckDraft({ runScenarios, serveApp })
