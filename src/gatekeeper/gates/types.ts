import type { GateName, Scenario } from "../../contracts"

/** Ulaz za kapije 1–4. */
export type GateInput = {
  /** Nacrt jedinice; isti raspored kao `app/src/` (npr. `screens/<id>/index.tsx`). */
  draftDir: string
  /** Trenutna aplikacija (`output/<run>/app`), sa već promovisanim jedinicama. */
  appDir: string
  /** Validirani testovi jedinice. */
  tests: Scenario[]
  /** Apsolutne putanje originalnih web fajlova jedinice (`Unit.sources`). */
  originalFiles: string[]
}

/** Rezultat jedne kapije; `checkDraft` (C2.3) dodaje `unitId` i `round`. */
export type GateCheck = { gate: GateName; ok: boolean; message: string }

export type Gate = (input: GateInput) => Promise<GateCheck>
