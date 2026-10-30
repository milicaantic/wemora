// Kapije 1–4, tačno ovim redom. Prva koja padne zaustavlja proveru.
import { forbiddenApisGate } from "./forbiddenApis"
import { labelsGate } from "./labels"
import { parseGate } from "./parse"
import { tscGate } from "./tsc"
import type { Gate, GateCheck, GateInput } from "./types"

export type { GateCheck, GateInput } from "./types"
export { forbiddenApisGate, labelsGate, parseGate, tscGate }

export const FAST_GATES: Gate[] = [parseGate, forbiddenApisGate, tscGate, labelsGate]

/** Pušta kapije redom; vraća rezultate do prve koja padne (uključujući nju). */
export async function runGates(input: GateInput, gates: Gate[] = FAST_GATES): Promise<GateCheck[]> {
  const results: GateCheck[] = []
  for (const gate of gates) {
    const result = await gate(input)
    results.push(result)
    if (!result.ok) break
  }
  return results
}
