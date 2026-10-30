import type { CheckDraft, ComputeStatus, Promote, Rollback, ServeApp } from "../contracts"

// Public API of gatekeeper/ (owner: C). Placeholders until F1; signatures come from contracts/api.ts.

export const checkDraft: CheckDraft = async () => {
  throw new Error("not implemented: checkDraft")
}

export const promote: Promote = async () => {
  throw new Error("not implemented: promote")
}

export const rollback: Rollback = async () => {
  throw new Error("not implemented: rollback")
}

export const serveApp: ServeApp = async () => {
  throw new Error("not implemented: serveApp")
}

export const computeStatus: ComputeStatus = () => {
  throw new Error("not implemented: computeStatus")
}
