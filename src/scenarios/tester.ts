import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import { ScenarioSchema, type Flow, type InteractiveElement, type Plan, type Scenario, type Unit } from "../contracts"
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
  writeScenarios(testsFile(runDir, unitId), scenarios)
}

// Flow tests (D-022) span several units and live in tests/flows/<flowId>.json.
export function flowTestsFile(runDir: string, flowId: string): string {
  return path.join(runDir, "tests", "flows", `${flowId}.json`)
}

export function readFlowTests(runDir: string, flowId: string): Scenario[] {
  const file = flowTestsFile(runDir, flowId)
  return existsSync(file) ? TestsFileSchema.parse(JSON.parse(readFileSync(file, "utf8"))) : []
}

export function writeFlowTests(runDir: string, flowId: string, scenarios: Scenario[]): void {
  writeScenarios(flowTestsFile(runDir, flowId), scenarios)
}

function writeScenarios(file: string, scenarios: Scenario[]): void {
  mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  writeFileSync(temporary, `${JSON.stringify(TestsFileSchema.parse(scenarios), null, 2)}\n`)
  renameSync(temporary, file)
}

/**
 * A flow as one unit for the tester (D-022): its first unit (where the test starts), the flow as the only
 * obligation, and the intentional differences of every unit in the flow, so a notPortable element of any
 * screen on the way is refused. The scenario rules then work the same as for a screen.
 */
export function flowAsUnit(flow: Flow, plan: Plan): Unit {
  const units = flow.unitIds.map((unitId) => {
    const unit = plan.units.find((u) => u.id === unitId)
    if (!unit) throw new Error(`flow "${flow.id}" names unit "${unitId}", which is not in the plan`)
    return unit
  })
  const first = units[0]
  if (!first || first.kind !== "screen" || !first.route) {
    throw new Error(`flow "${flow.id}" must start with a screen that has a route, not "${flow.unitIds[0]}"`)
  }
  return {
    ...first,
    obligations: [{ id: flow.id, description: flow.description }],
    intentionalDifferences: units.flatMap((u) => u.intentionalDifferences),
  }
}

/**
 * Why this scenario cannot be saved for this unit, or null. Only checks that need no browser:
 * validateScenario does the rest. A step on a notPortable element is refused here, because the
 * original still has that element and the scenario would pass validation, then fail on every phone.
 * `flowId` is set for a flow test (D-022): the scenario must carry it; a screen test must not have one.
 */
export function scenarioProblem(scenario: Scenario, unit: Unit, saved: Scenario[], flowId?: string): string | null {
  if (flowId !== undefined && scenario.flowId !== flowId) return `flowId must be "${flowId}" for this flow test.`
  if (flowId === undefined && scenario.flowId !== undefined) return `Leave flowId out: this task tests one screen, not a flow.`
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

/**
 * The path that opens a web route in the browser, or null when it needs real values for its parameters.
 * A catch-all ends in "*" and matches any path: "*" opens at "/", "/docs/*" at "/docs/".
 */
export function openablePath(route: string): string | null {
  if (route.includes(":")) return null
  const path = route.endsWith("*") ? route.slice(0, -1) : route
  return path.startsWith("/") ? path : `/${path}`
}

/** The task message: what to test on this unit and what is already saved. */
export function testerBrief(unit: Unit, interactive: InteractiveElement[], saved: Scenario[]): string {
  const open = unit.route === undefined ? null : openablePath(unit.route)
  const lines = [
    `Unit: ${unit.id}`,
    `Web route: ${unit.route ?? "(none)"}`,
    unit.route !== undefined && open === null
      ? "The route has parameters: open it with real values, e.g. an id you find in a link on another screen."
      : null,
    open !== null && open !== unit.route ? `The route matches any path; open it at ${open}` : null,
    "",
    "Obligations (each needs at least one saved scenario, with this id in `obligation`):",
    ...unit.obligations.map((o) => `- ${o.id}: ${o.description}`),
    "",
  ]
  if (interactive.length > 0) {
    lines.push(
      "Interactive elements of this screen. Use each one in a tap, fill or submit step of at least one scenario:",
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

// Saved screen tests shown per unit in a flow task: enough to copy exact names and setup steps.
const EXAMPLES_PER_UNIT = 2

/** The task message for a flow test (D-022): the flow, its screens in order, and saved tests of those screens. */
export function flowBrief(flow: Flow, plan: Plan, unitTests: Record<string, Scenario[]>, saved: Scenario[]): string {
  const unit = flowAsUnit(flow, plan)
  const lines = [
    `Flow: ${flow.id}`,
    flow.description,
    "",
    "The flow goes through these screens, in this order:",
    ...flow.unitIds.map((unitId) => `- ${unitId}: route ${plan.units.find((u) => u.id === unitId)?.route ?? "(shared, no route)"}`),
    "",
    `Write ONE scenario that does this flow, with unitId "${unit.id}", obligation "${flow.id}" and flowId "${flow.id}".`,
    `Start with goto on ${unit.route} and reach the other screens by tapping links or buttons, as a user would; do not goto them.`,
    "Check at the end what the flow promises, on the last screen.",
  ]
  const examples = flow.unitIds.flatMap((unitId) => (unitTests[unitId] ?? []).slice(0, EXAMPLES_PER_UNIT))
  if (examples.length > 0) {
    lines.push("", "Saved tests of these screens (use the same names, texts and setup steps):", ...examples.map((s) => `- ${s.id}: ${JSON.stringify(s.steps)}`))
  }
  const notPortable = unit.intentionalDifferences.flatMap((d) => (d.kind === "notPortable" ? [d] : []))
  if (notPortable.length > 0) {
    lines.push("", "Never use these elements, they do not exist on mobile:", ...notPortable.map((d) => `- ${d.element.role} "${d.element.name}" (${d.reason})`))
  }
  lines.push("", saved.length > 0 ? `Already saved for this flow: ${saved.map((s) => s.id).join(", ")}` : "No scenario is saved for this flow yet.")
  return lines.join("\n")
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
