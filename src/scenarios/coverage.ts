import type { ComputeCoverage, InteractiveElement } from "../contracts"
import { actedOn, sameElement, toTarget, type Target } from "./compile"

/**
 * What the unit's validated scenarios cover (architecture.md §11): obligations from the plan, and the interactive
 * elements of the original used by at least one tap, fill or submit (setup included). Elements marked notPortable in the
 * plan are listed apart and never count as missing. Every element lands in exactly one of the three lists.
 * Scenarios of other units are ignored; movedTo does not change coverage yet (docs/tasks/b.md Q6).
 */
export const computeCoverage: ComputeCoverage = (unit, scenarios, interactive) => {
  const own = scenarios.filter((s) => s.unitId === unit.id)

  const tested = new Set(own.map((s) => s.obligation))
  const obligations = unit.obligations.map((o) => o.id)

  const used: Target[] = own.flatMap((s) => [...(s.setup ?? []), ...s.steps].map(actedOn).filter((t) => t !== null))
  const notPortable: Target[] = unit.intentionalDifferences.flatMap((d) => (d.kind === "notPortable" ? [toTarget(d.element)] : []))
  const elements = { covered: [] as InteractiveElement[], missing: [] as InteractiveElement[], notPortable: [] as InteractiveElement[] }
  for (const element of interactive) {
    const target = toTarget(element)
    if (notPortable.some((t) => sameElement(t, target))) elements.notPortable.push(element)
    else if (used.some((t) => sameElement(t, target))) elements.covered.push(element)
    else elements.missing.push(element)
  }

  return {
    unitId: unit.id,
    obligations: {
      covered: obligations.filter((id) => tested.has(id)),
      missing: obligations.filter((id) => !tested.has(id)),
    },
    elements,
  }
}
