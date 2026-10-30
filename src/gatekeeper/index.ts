import type { CheckDraft, ComputeStatus } from "../contracts"

// Javni API gatekeeper/ (vlasnik: C). Potpisi su u contracts/api.ts.

export { promote, rollback } from "./promote"
export { serveApp } from "./serve"

export const checkDraft: CheckDraft = async () => {
  throw new Error("not implemented: checkDraft")
}

export const computeStatus: ComputeStatus = () => {
  throw new Error("not implemented: computeStatus")
}
