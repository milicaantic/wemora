import type { MigrationStateFields, Unit, UnitStatus } from "../contracts"

// Task queue as pure functions over a board snapshot (architecture.md §9): no Mozaik, no clock.
// The Conductor asks "what next?" and writes the answer to the board itself.

export type QueueView = Pick<MigrationStateFields, "plan" | "units" | "tests">

// A unit the Conductor has not touched yet counts as waiting.
const statusOf = (view: QueueView, unitId: string): UnitStatus => view.units[unitId]?.status ?? "waiting"
const hasTests = (view: QueueView, unitId: string) => (view.tests[unitId]?.length ?? 0) > 0
const isFinal = (status: UnitStatus) => status === "promoted" || status === "failed"

function flowCount(view: QueueView, unitId: string): number {
  return view.plan?.flows.filter((flow) => flow.unitIds.includes(unitId)).length ?? 0
}

// Rules 3 and 4 of §9, then wave and id so the order is always the same.
function byFlowsThenSize(view: QueueView) {
  return (a: Unit, b: Unit) =>
    flowCount(view, b.id) - flowCount(view, a.id) || b.size - a.size || a.wave - b.wave || a.id.localeCompare(b.id)
}

// Waiting units whose dependencies are all promoted, best first: tests already exist (rule 2),
// more flows depend on it (rule 3), bigger before smaller (rule 4).
export function readyUnits(view: QueueView): Unit[] {
  const units = view.plan?.units ?? []
  const byFlowsAndSize = byFlowsThenSize(view)
  return units
    .filter((unit) => statusOf(view, unit.id) === "waiting")
    .filter((unit) => unit.dependsOn.every((dep) => statusOf(view, dep) === "promoted"))
    .sort((a, b) => Number(hasTests(view, b.id)) - Number(hasTests(view, a.id)) || byFlowsAndSize(a, b))
}

export function nextForBuilder(view: QueueView): Unit | undefined {
  return readyUnits(view)[0]
}

// Testers work on the original app, so every screen of every wave is open from the start (§4 step 6).
// Rules 1 and 2 do not apply to testers (docs/tasks/a.md, P8); shared units have no UI tests of their own.
export function nextForTester(view: QueueView, beingTested: ReadonlySet<string>): Unit | undefined {
  const units = view.plan?.units ?? []
  return units
    .filter((unit) => unit.kind === "screen")
    .filter((unit) => !hasTests(view, unit.id) && !beingTested.has(unit.id) && !isFinal(statusOf(view, unit.id)))
    .sort(byFlowsThenSize(view))[0]
}

// Units that became ready because `promotedUnitId` was promoted.
export function unlockedBy(view: QueueView, promotedUnitId: string): Unit[] {
  const promoted = (unitId: string) => unitId === promotedUnitId || statusOf(view, unitId) === "promoted"
  return (view.plan?.units ?? []).filter(
    (unit) =>
      unit.dependsOn.includes(promotedUnitId) &&
      statusOf(view, unit.id) === "waiting" &&
      unit.dependsOn.every(promoted),
  )
}

// Waiting units that can never start because `failedUnitId` failed, directly or through other units.
// The Conductor marks them failed so the run can finish (docs/tasks/a.md, P7).
export function blockedBy(view: QueueView, failedUnitId: string): Unit[] {
  const units = view.plan?.units ?? []
  const blocked = new Set<string>([failedUnitId])
  let grew = true
  while (grew) {
    grew = false
    for (const unit of units) {
      if (!blocked.has(unit.id) && unit.dependsOn.some((dep) => blocked.has(dep))) {
        blocked.add(unit.id)
        grew = true
      }
    }
  }
  return units.filter((unit) => unit.id !== failedUnitId && blocked.has(unit.id) && statusOf(view, unit.id) === "waiting")
}

// True when every unit of the plan is promoted or failed (§4 step 11).
export function isFinished(view: QueueView): boolean {
  const units = view.plan?.units ?? []
  return units.length > 0 && units.every((unit) => isFinal(statusOf(view, unit.id)))
}
