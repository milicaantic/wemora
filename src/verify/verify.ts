import { existsSync, readFileSync, symlinkSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PlanSchema, UnitResultSchema, type Plan, type RunScenarios, type ScenarioResult, type Scenario, type ScreenStatus, type ServeApp, type Verify } from "../contracts"
import { PHONE, serveApp } from "../gatekeeper"
import { readTests, runScenarios } from "../scenarios"

// verify (architecture.md §13, invariant 10): runs every saved test of a finished run again, on a fresh web export
// of its app/, without a model, an API key or Mozaik, and with the same result every time.

const TEMPLATE_MODULES = fileURLToPath(new URL("../../templates/expo/node_modules", import.meta.url))

export type VerifyDeps = { serveApp: ServeApp; runScenarios: RunScenarios }

export type UnitCheck = {
  unitId: string
  /** From results/<unitId>.json; null when the run wrote no result for the unit. */
  status: ScreenStatus | null
  /** Its tests passed at gate 5 (proven or partial), so they must still pass now. */
  counted: boolean
  tests: Scenario[]
  results: ScenarioResult[]
}

export type VerifyDetails = { runDir: string; ok: boolean; units: UnitCheck[] }

/** Real export through gatekeeper's serveApp; a committed run has no node_modules, so they are linked first. */
export const defaultVerifyDeps: VerifyDeps = {
  serveApp: async (appDir) => {
    linkTemplateModules(appDir)
    return serveApp(appDir)
  },
  runScenarios,
}

export function createVerifyDetailed(deps: VerifyDeps = defaultVerifyDeps): (runDir: string) => Promise<VerifyDetails> {
  return async (input) => {
    const runDir = path.resolve(input)
    const plan = readPlan(runDir)
    const units = plan.units
      .filter((u) => u.kind === "screen")
      .map((u) => ({ unit: u, status: readStatus(runDir, u.id), tests: readTests(runDir, u.id) }))

    const checks: UnitCheck[] = []
    const withTests = units.filter((u) => u.tests.length > 0)
    if (withTests.length > 0) {
      const app = await deps.serveApp(path.join(runDir, "app"))
      try {
        // One unit after another, in plan order, so the output is the same every time.
        for (const { unit, status, tests } of withTests) {
          const results = await deps.runScenarios(app.url, tests, { viewport: PHONE, differences: unit.intentionalDifferences })
          checks.push({ unitId: unit.id, status, counted: status === "proven" || status === "partial", tests, results })
        }
      } finally {
        await app.close().catch(() => {})
      }
    }
    for (const { unit, status } of units.filter((u) => u.tests.length === 0)) {
      checks.push({ unitId: unit.id, status, counted: false, tests: [], results: [] })
    }
    const order = new Map(plan.units.map((u, i) => [u.id, i]))
    checks.sort((a, b) => (order.get(a.unitId) ?? 0) - (order.get(b.unitId) ?? 0))

    const ok = checks.filter((c) => c.counted).every((c) => passedAll(c))
    return { runDir, ok, units: checks }
  }
}

export const verifyDetailed = createVerifyDetailed()

export const verify: Verify = async (runDir) => {
  const details = await verifyDetailed(runDir)
  return { ok: details.ok, results: Object.fromEntries(details.units.map((u) => [u.unitId, u.results])) }
}

/** The screen × test matrix for the console. No durations, so two runs print the same text. */
export function formatVerifyReport(details: VerifyDetails): string {
  const lines = [`verify ${details.runDir}`, ""]
  for (const unit of details.units) {
    const note = unit.counted ? "" : unit.tests.length === 0 ? "  (no tests)" : "  (not counted: its tests did not pass in the run)"
    lines.push(`${unit.unitId}  [${unit.status ?? "no result"}]${note}`)
    const byId = new Map(unit.results.map((r) => [r.scenarioId, r]))
    for (const test of unit.tests) {
      const r = byId.get(test.id)
      const where = r?.failedStep === undefined ? "" : ` at step ${r.failedStep + 1}`
      lines.push(r?.ok ? `  pass  ${test.id}` : `  FAIL  ${test.id}${where}: ${r?.error ?? "no result"}`)
    }
  }
  const counted = details.units.filter((u) => u.counted)
  const tests = counted.reduce((n, u) => n + u.tests.length, 0)
  const passed = counted.reduce((n, u) => n + u.results.filter((r) => r.ok).length, 0)
  lines.push("", `${details.ok ? "OK" : "FAILED"}: ${passed}/${tests} tests pass on ${counted.length} screen(s) whose tests passed in the run`)
  return lines.join("\n")
}

function passedAll(unit: UnitCheck): boolean {
  const byId = new Map(unit.results.map((r) => [r.scenarioId, r]))
  return unit.tests.every((t) => byId.get(t.id)?.ok === true)
}

function readPlan(runDir: string): Plan {
  const file = path.join(runDir, "plan.json")
  if (!existsSync(file)) throw new Error(`${file} not found: is ${runDir} the folder of a finished run (output/<run-id> or runs/<x>)?`)
  return PlanSchema.parse(JSON.parse(readFileSync(file, "utf8")))
}

function readStatus(runDir: string, unitId: string): ScreenStatus | null {
  const file = path.join(runDir, "results", `${unitId}.json`)
  return existsSync(file) ? UnitResultSchema.parse(JSON.parse(readFileSync(file, "utf8"))).status : null
}

// Like scaffold(): the template's packages are linked, not copied (hundreds of MB, and they are not in git).
function linkTemplateModules(appDir: string): void {
  if (!existsSync(path.join(appDir, "src"))) throw new Error(`${appDir} has no src/: the run has no app to check`)
  const modules = path.join(appDir, "node_modules")
  if (existsSync(modules)) return
  if (!existsSync(TEMPLATE_MODULES)) {
    throw new Error(`${TEMPLATE_MODULES} not found: run "npm ci" in templates/expo once, then verify again`)
  }
  symlinkSync(TEMPLATE_MODULES, modules, "junction")
}
