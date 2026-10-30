import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import { ScenarioSchema, type InteractiveElement, type Scenario, type Unit } from "../contracts"
import { actedOn, describeTarget, sameElement, toTarget } from "./compile"
import { computeCoverage } from "./coverage"

// The domain side of the tester agent (agents/tester.ts): rules for saving a scenario, the tests file,
// and the texts the model reads. No Mozaik here.

// tests/<unitId>.json is an array of scenarios. Replace with the contracts schema once A adds it (contracts/f1).
const TestsFileSchema = z.array(ScenarioSchema)

export function testsFile(runDir: string, unitId: string): string {
  return path.join(runDir, "tests", `${unitId}.json`)
}

export function readTests(runDir: string, unitId: string): Scenario[] {
  const file = testsFile(runDir, unitId)
  return existsSync(file) ? TestsFileSchema.parse(JSON.parse(readFileSync(file, "utf8"))) : []
}

/** Writes through a temporary file, so a reader never sees half a file. */
export function writeTests(runDir: string, unitId: string, scenarios: Scenario[]): void {
  const file = testsFile(runDir, unitId)
  mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  writeFileSync(temporary, `${JSON.stringify(TestsFileSchema.parse(scenarios), null, 2)}\n`)
  renameSync(temporary, file)
}

/**
 * Why this scenario cannot be saved for this unit, or null. Only checks that need no browser:
 * validateScenario does the rest. A step on a notPortable element is refused here, because the
 * original still has that element and the scenario would pass validation, then fail on every phone.
 */
export function scenarioProblem(scenario: Scenario, unit: Unit, saved: Scenario[]): string | null {
  if (scenario.unitId !== unit.id) return `unitId must be "${unit.id}", not "${scenario.unitId}".`
  if (!unit.obligations.some((o) => o.id === scenario.obligation)) {
    return `Unknown obligation "${scenario.obligation}". Use one of: ${unit.obligations.map((o) => o.id).join(", ")}.`
  }
  if (saved.some((s) => s.id === scenario.id)) return `A scenario with id "${scenario.id}" is already saved. Use a new id.`

  const steps = [...(scenario.setup ?? []), ...scenario.steps]
  for (const difference of unit.intentionalDifferences) {
    if (difference.kind !== "notPortable") continue
    const element = toTarget(difference.element)
    const used = steps.find((step) => {
      const target = actedOn(step)
      return target !== null && sameElement(target, element)
    })
    if (used) {
      return `It uses ${describeTarget(element)}, which does not exist on mobile (${difference.reason}). Test this behavior without it, or test something else.`
    }
  }
  return null
}

/** The task message: what to test on this unit and what is already saved. */
export function testerBrief(unit: Unit, interactive: InteractiveElement[], saved: Scenario[]): string {
  const lines = [
    `Unit: ${unit.id}`,
    `Web route: ${unit.route ?? "(none)"}`,
    unit.route?.includes(":") ? "The route has parameters: open it with real values, e.g. an id you find in a link on another screen." : null,
    "",
    "Obligations (each needs at least one saved scenario, with this id in `obligation`):",
    ...unit.obligations.map((o) => `- ${o.id}: ${o.description}`),
    "",
  ]
  if (interactive.length > 0) {
    lines.push(
      "Interactive elements of this screen. Use each one in a tap or fill step of at least one scenario:",
      ...interactive.map((e) => `- ${e.role} "${e.name}"`),
      "",
    )
  }
  const notPortable = unit.intentionalDifferences.flatMap((d) => (d.kind === "notPortable" ? [d] : []))
  if (notPortable.length > 0) {
    lines.push(
      "Never use these elements, they do not exist on mobile:",
      ...notPortable.map((d) => `- ${d.element.role} "${d.element.name}" (${d.reason})`),
      "",
    )
  }
  lines.push(
    saved.length > 0
      ? `Already saved (keep them, add what is missing): ${saved.map((s) => `${s.id} [${s.obligation}]`).join(", ")}`
      : "No scenarios are saved yet.",
  )
  return lines.filter((line) => line !== null).join("\n")
}

/** What save_scenario tells the model after a save: what is still missing, or that it may finish. */
export function coverageNote(unit: Unit, saved: Scenario[], interactive: InteractiveElement[]): string {
  const coverage = computeCoverage(unit, saved, interactive)
  const missingObligations = coverage.obligations.missing
  const missingElements = coverage.elements.missing.map((e) => `${e.role} "${e.name}"`)
  if (missingObligations.length === 0 && missingElements.length === 0) {
    return "All obligations and interactive elements are covered. Reply with a one-line summary to finish."
  }
  const parts = []
  if (missingObligations.length > 0) parts.push(`Obligations still without a scenario: ${missingObligations.join(", ")}.`)
  if (missingElements.length > 0) parts.push(`Elements not used in any scenario yet: ${missingElements.join(", ")}.`)
  return parts.join(" ")
}
