// checkDraft (C2.3): ceo put jednog nacrta kroz Gatekeeper.
//
// Ekran:     kapije 1–4 → promote → kapija 5 (testovi jedinice) → regresija → rollback ako 5 ili regresija padne
// Zajednička: kapije 1–3  → promote → regresija → rollback ako regresija padne
//
// Nacrt se privremeno ubacuje u app/ pre kapije 5: jedan web export nad istim app/ (topao Metro keš,
// ~6 s, D-006/D-009) služi i kapiji 5 i regresiji. Ako bilo šta padne, rollback vraća app/ tačno
// kakav je bio, pa je ishod isti kao "kapija 5 pa promote".
import { join } from "node:path"
import type {
  CheckDraft,
  GateName,
  GateResult,
  RunScenarios,
  Scenario,
  ScenarioResult,
  ServeApp,
  Unit,
  Viewport,
} from "../contracts"
import { forbiddenApisGate, parseGate, runGates, tscGate } from "./gates/index"
import { appDirOf, promote, rollback } from "./promote"
import { smoke as realSmoke, type Smoke } from "./smoke"

/** Telefon iz architecture.md §11. */
export const PHONE: Viewport = { width: 390, height: 844 }

export type CheckDraftDeps = {
  runScenarios: RunScenarios
  serveApp: ServeApp
  /** „Dimna“ provera zajedničke jedinice: aplikacija sa nacrtom se otvara na `/` bez pada (A → C). */
  smoke?: Smoke
}

type Promoted = { unit: Unit; tests: Scenario[] }

const MAX_SHOWN_FAILURES = 5
const NO_TESTS = "Nema validiranih testova: ekran ulazi u aplikaciju kao nedokazan (unproven)."

/** checkDraft plus rezultati testova iz poslednje kapije 5, za `UnitResult.scenarios` (D → C, inbox). */
export type CheckDraftWithResults = CheckDraft & {
  /** Jedan `ScenarioResult` po testu jedinice iz poslednje provere; prazno ako kapija 5 nije puštena. */
  scenariosOf: (unitId: string) => ScenarioResult[]
}

/** Pravi checkDraft sa svojim spiskom promovisanih jedinica (za regresiju). */
export function createCheckDraft(deps: CheckDraftDeps): CheckDraftWithResults {
  // Jedinice koje su prošle ceo put, sa testovima i namernim razlikama: regresija ih pušta ponovo.
  const promoted = new Map<string, Promoted>()
  // Rezultati testova jedinice iz poslednje provere (i kad prolaze i kad padaju).
  const lastRuns = new Map<string, ScenarioResult[]>()

  const check: CheckDraft = async ({ unit, round, draftDir, tests, webDir }) => {
    lastRuns.delete(unit.id)
    const results: GateResult[] = []
    const add = (gate: GateName, ok: boolean, message: string, brokenTests?: string[]) => {
      results.push({ unitId: unit.id, round, gate, ok, message, ...(brokenTests ? { brokenTests } : {}) })
      return ok
    }

    let appDir: string
    try {
      appDir = appDirOf(draftDir)
    } catch (error) {
      add("parse", false, `Gatekeeper: ${message(error)}`)
      return results
    }

    // Kapije 1–4 (zajedničke jedinice: 1–3, nemaju svoje UI testove).
    const fast = await runGates(
      { draftDir, appDir, tests, originalFiles: unit.sources.map((s) => join(webDir, s)) },
      unit.kind === "shared" ? [parseGate, forbiddenApisGate, tscGate] : undefined,
    )
    for (const r of fast) add(r.gate, r.ok, r.message)
    if (fast.some((r) => !r.ok)) return results

    try {
      await promote(unit.id, draftDir)
    } catch (error) {
      add("scenarios", false, `Gatekeeper: nacrt nije mogao da se ubaci u aplikaciju: ${message(error)}`)
      return results
    }

    const others = [...promoted.values()].filter((p) => p.unit.id !== unit.id && p.tests.length > 0)
    const needsBrowser = unit.kind === "shared" || (unit.kind === "screen" && tests.length > 0) || others.length > 0

    let ok = true
    if (needsBrowser) {
      let app: Awaited<ReturnType<ServeApp>> | null = null
      try {
        app = await deps.serveApp(appDir)
        if (unit.kind === "screen") ok = tests.length > 0 ? await gate5(app.url, unit, tests, add) : add("scenarios", true, NO_TESTS)
        else ok = await smokeGate(app.url, add)
        if (ok) ok = await regression(app.url, others, add)
      } catch (error) {
        const why = `Gatekeeper: aplikacija nije mogla da se pokrene: ${message(error)}`
        if (unit.kind === "screen" && tests.length > 0 && !lastRuns.has(unit.id)) lastRuns.set(unit.id, perTest(tests, [], why))
        ok = add(unit.kind === "screen" ? "scenarios" : "regression", false, why)
      } finally {
        await app?.close().catch(() => {})
      }
    } else if (unit.kind === "screen") {
      add("scenarios", true, NO_TESTS)
    }

    if (!ok) {
      await rollback(unit.id)
      return results
    }
    promoted.set(unit.id, { unit, tests })
    return results
  }

  return Object.assign(check, { scenariosOf: (unitId: string) => lastRuns.get(unitId) ?? [] })

  // Zajednička jedinica nema testove: bar da se aplikacija sa njom otvara. Ugovor nema posebno ime
  // kapije za ovo, pa ide pod "scenarios" (poruka kaže šta je provereno).
  async function smokeGate(url: string, add: AddResult): Promise<boolean> {
    const result = await (deps.smoke ?? realSmoke)(url)
    if (result.ok) return add("scenarios", true, "The app with this shared unit opens on the web without errors.")
    return add("scenarios", false, `${result.message}. Fix the shared unit: every screen is rendered inside it.`)
  }

  async function gate5(url: string, unit: Unit, tests: Scenario[], add: AddResult): Promise<boolean> {
    const runs = await deps.runScenarios(url, tests, { viewport: PHONE, differences: unit.intentionalDifferences })
    lastRuns.set(unit.id, perTest(tests, runs, "nema rezultata"))
    const failed = failures(tests, runs)
    if (failed.length === 0) return add("scenarios", true, `Svi testovi jedinice prolaze (${tests.length}).`)
    return add("scenarios", false, `Testovi ne prolaze na telefonu (${failed.length} od ${tests.length}):\n${describe(failed)}`)
  }

  async function regression(url: string, others: Promoted[], add: AddResult): Promise<boolean> {
    if (others.length === 0) return true
    const failed: Failure[] = []
    let total = 0
    for (const { unit, tests } of others) {
      total += tests.length
      const runs = await deps.runScenarios(url, tests, { viewport: PHONE, differences: unit.intentionalDifferences })
      failed.push(...failures(tests, runs))
    }
    if (failed.length === 0) return add("regression", true, `Već promovisani ekrani i dalje rade (${total} testova).`)
    return add(
      "regression",
      false,
      `Nacrt je pokvario ekrane koji su već radili (${failed.length} od ${total} testova), pa je vraćen:\n${describe(failed)}`,
      failed.map((f) => f.id),
    )
  }
}

type AddResult = (gate: GateName, ok: boolean, message: string, brokenTests?: string[]) => boolean
type Failure = { id: string; unitId: string; step?: number; error: string }

/** Tačno jedan rezultat po testu, redom kao testovi; test bez rezultata je pao sa porukom `missing`. */
function perTest(tests: Scenario[], runs: ScenarioResult[], missing: string): ScenarioResult[] {
  const byId = new Map(runs.map((r) => [r.scenarioId, r]))
  return tests.map((t) => byId.get(t.id) ?? { scenarioId: t.id, unitId: t.unitId, ok: false, durationMs: 0, error: missing })
}

/** Test bez rezultata se računa kao pao, isto kao u computeStatus. */
function failures(tests: Scenario[], runs: ScenarioResult[]): Failure[] {
  const byId = new Map(runs.map((r) => [r.scenarioId, r]))
  return tests.flatMap((t) => {
    const r = byId.get(t.id)
    if (r?.ok) return []
    return [{ id: t.id, unitId: t.unitId, step: r?.failedStep, error: r?.error ?? "nema rezultata" }]
  })
}

function describe(failed: Failure[]): string {
  const shown = failed.slice(0, MAX_SHOWN_FAILURES).map((f) => {
    const where = f.step === undefined ? "" : ` na koraku ${f.step + 1}`
    return `- test "${f.id}" (ekran ${f.unitId})${where}: ${f.error}`
  })
  if (failed.length > MAX_SHOWN_FAILURES) shown.push(`- … i još ${failed.length - MAX_SHOWN_FAILURES}`)
  return shown.join("\n")
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
