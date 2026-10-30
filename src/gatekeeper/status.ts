// Status ekrana po tabeli iz architecture.md §10.
import type { ComputeStatus, ScenarioResult } from "../contracts"

/**
 * Redosled je bitan:
 * 1. nema testova → unproven (nula testova NIKAD nije proven, bez obzira na ostalo)
 * 2. bar jedan test nema uspešan poslednji rezultat → failed (test bez rezultata se računa kao pao)
 * 3. pokrivenost nepoznata ili nepotpuna → partial
 * 4. inače → proven
 *
 * `roundsExhausted` ne menja status: test koji pada je `failed` i pre poslednje runde,
 * jer nijedan drugi status ne odgovara (vidi docs/status/c.md).
 */
export const computeStatus: ComputeStatus = ({ tests, results, coverage }) => {
  if (tests.length === 0) return "unproven"

  // Ako isti test ima više rezultata, važi poslednji.
  const latest = new Map<string, ScenarioResult>()
  for (const r of results) latest.set(r.scenarioId, r)
  const allPass = tests.every((t) => latest.get(t.id)?.ok === true)
  if (!allPass) return "failed"

  if (coverage === null) return "partial"
  // notPortable elementi se ne računaju: nisu ni u covered ni u missing.
  if (coverage.obligations.missing.length > 0 || coverage.elements.missing.length > 0) return "partial"
  return "proven"
}
