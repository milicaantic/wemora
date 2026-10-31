// checkFlow (C3.3, D-022): testovi toka nad aplikacijom u kojoj su sve jedinice toka već promovisane.
// Tok koji pada NE vraća nijedan ekran (svaki je dokazan svojim testovima); rezultat se samo prijavljuje.
import type { Flow, FlowResult, IntentionalDifference, RunScenarios, Scenario, ScenarioResult, ServeApp } from "../contracts"
import { PHONE } from "./check"

export type CheckFlowDeps = { runScenarios: RunScenarios; serveApp: ServeApp }
export type CheckFlowInput = {
  flow: Flow
  tests: Scenario[]
  appDir: string
  /** Namerne razlike svih jedinica toka (npr. element iza dugmeta na telefonu). */
  differences: IntentionalDifference[]
}
export type CheckFlow = (input: CheckFlowInput) => Promise<FlowResult>

export function createCheckFlow(deps: CheckFlowDeps): CheckFlow {
  return async ({ flow, tests, appDir, differences }) => {
    if (tests.length === 0) return { flowId: flow.id, ok: false, scenarios: [] }
    let runs: ScenarioResult[]
    let app: Awaited<ReturnType<ServeApp>> | null = null
    try {
      app = await deps.serveApp(appDir)
      runs = await deps.runScenarios(app.url, tests, { viewport: PHONE, differences })
    } catch (error) {
      const why = `Gatekeeper: aplikacija nije mogla da se pokrene: ${error instanceof Error ? error.message : String(error)}`
      runs = tests.map((t) => ({ scenarioId: t.id, unitId: t.unitId, ok: false, durationMs: 0, error: why }))
    } finally {
      await app?.close().catch(() => {})
    }
    // Test bez rezultata se računa kao pao, isto kao u checkDraft i computeStatus.
    const byId = new Map(runs.map((r) => [r.scenarioId, r]))
    const scenarios = tests.map(
      (t) => byId.get(t.id) ?? { scenarioId: t.id, unitId: t.unitId, ok: false, durationMs: 0, error: "nema rezultata" },
    )
    return { flowId: flow.id, ok: scenarios.every((s) => s.ok), scenarios }
  }
}
