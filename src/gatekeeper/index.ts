import type { CheckDraft } from "../contracts"

// Javni API gatekeeper/ (vlasnik: C). Potpisi su u contracts/api.ts.

export { promote, rollback } from "./promote"
export { serveApp } from "./serve"
export { computeStatus } from "./status"

export const checkDraft: CheckDraft = async () => {
  throw new Error("not implemented: checkDraft")
}
