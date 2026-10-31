import { ScenarioSchema, type RunScenarios, type Scenario, type ScenarioResult, type Step, type ValidateScenario } from "../contracts"
import { createRunScenarios, PROBE_RUNNER_SETTINGS, runScenarios } from "./run"
import { DESKTOP, MOBILE } from "./viewports"

const isAction = (s: Step) => "tap" in s || "fill" in s || "submit" in s
const isExpect = (s: Step) => "expectVisible" in s || "expectNotVisible" in s

/**
 * A scenario becomes evidence only if (architecture.md §11):
 * 1. it passes on the original twice in a row;
 * 2. its steps fail on the blank screen (setup is skipped there, mobile viewport, no reveal);
 * 3. every action (tap/fill/submit) followed by checks changes something: at least one of those checks
 *    fails when the action is left out (the steps before it and the goto steps up to the check stay).
 * Reasons are written for the tester model, so it can fix the scenario.
 *
 * `probe` runs what is expected to fail (the blank screen, the rule 3 variants) with shorter waits: a failing step
 * waits its whole timeout, and that was most of try_scenario's time (A's inbox 2026-10-31). Rule 1 keeps `run`,
 * so a slow but good scenario is never refused. Without `probe`, `run` does both.
 */
export function createValidateScenario(run: RunScenarios = runScenarios, probe: RunScenarios = run): ValidateScenario {
  return async (originalUrl, blankUrl, input) => {
    const parsed = ScenarioSchema.safeParse(input)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return { ok: false, reason: `Invalid scenario: ${issue?.path.join(".")}: ${issue?.message}` }
    }
    const scenario = parsed.data
    const desktop = { viewport: DESKTOP, differences: [] }

    const [first, second] = await run(originalUrl, [scenario, scenario], desktop)
    if (!first.ok) return { ok: false, reason: `Fails on the original web app: ${failure(scenario, first)}` }
    if (!second.ok) {
      return { ok: false, reason: `Unstable: passed once on the original, then failed: ${failure(scenario, second)}` }
    }

    const [onBlank] = await probe(blankUrl, [{ ...scenario, setup: undefined }], { viewport: MOBILE, differences: [] })
    if (onBlank.ok) {
      return {
        ok: false,
        reason: "Passes on the blank placeholder screen too, so it checks nothing specific to this screen. Check content or behavior that only this screen has.",
      }
    }
    const blankStep = onBlank.failedStep === undefined ? undefined : scenario.steps[onBlank.failedStep]
    if (blankStep && "goto" in blankStep) {
      return { ok: false, reason: `Blank screen did not load, so the scenario could not be checked against it: ${onBlank.error}` }
    }

    // In rounds: the n-th variant of every action not proven yet, in one browser. An action is proven as soon as
    // one variant fails, so its other variants never run.
    let open = actionProbes(scenario)
    for (let round = 0; open.length > 0; round++) {
      const results = await probe(originalUrl, open.map((p) => p.variants[round]!), desktop)
      // A browser that did not start is not a failing check: it proves nothing.
      const broken = results.find((r) => r.error?.startsWith("browser did not start"))
      if (broken) return { ok: false, reason: `Could not check the scenario: ${broken.error}` }
      // An action with a failing variant is proven; one whose every variant passed changes nothing.
      open = open.filter((_, i) => results[i]!.ok)
      const unproven = open.find((p) => p.variants.length === round + 1)
      if (unproven) return changesNothing(scenario, unproven)
    }
    return { ok: true }
  }
}

export const validateScenario: ValidateScenario = createValidateScenario(runScenarios, createRunScenarios(PROBE_RUNNER_SETTINGS))

function changesNothing(scenario: Scenario, probe: Probe): { ok: false; reason: string } {
  const checks = probe.checks.map((i) => `step ${i} ${JSON.stringify(scenario.steps[i])}`).join(", ")
  return {
    ok: false,
    reason:
      `The action at step ${probe.action} (${JSON.stringify(scenario.steps[probe.action])}) changes nothing the scenario checks: ` +
      `without it, every check after it still passes (${checks}). ` +
      `Add a check that is false without the action and true with it. ${CHANGES_NOTHING_HINT}`,
  }
}

// The usual causes in real runs (A's inbox message 2026-10-31, `navigate-to-detail`), so the tester does not
// spend all its attempts on the same mistake.
const CHANGES_NOTHING_HINT =
  "After a tap that leaves this screen, check that this screen is gone: expectNotVisible a text only this screen has " +
  "(e.g. the search field label on a list): the name you tapped is usually visible on both screens. " +
  "In a screen test never check a text of the other screen: it may not be in the app yet, so both screens would be blocked. " +
  "After a button that changes state, check what it changes (a new button name, a message, a count). " +
  "If the action only prepares state for a later check, put it in setup (on this screen only)."

type Probe = { action: number; checks: number[]; variants: Scenario[] }

// For each action followed by checks: one variant per check, without the action. The goto steps between the
// action and the check stay, so the check runs on the same screen as in the scenario (e.g. tap "Dodaj u
// omiljene", goto /omiljeni, expectVisible a recipe: without the tap, the favorites screen is empty).
function actionProbes(scenario: Scenario): Probe[] {
  const probes: Probe[] = []
  const { steps } = scenario
  for (const [action, step] of steps.entries()) {
    if (!isAction(step)) continue
    const checks: number[] = []
    for (let i = action + 1; i < steps.length && !isAction(steps[i]); i++) {
      if (isExpect(steps[i])) checks.push(i)
    }
    if (checks.length === 0) continue
    const variants = checks.map((check) => ({
      ...scenario,
      id: `${scenario.id}#without-${action}-${check}`,
      steps: [...steps.slice(0, action), ...steps.slice(action + 1, check).filter((s) => "goto" in s), steps[check]],
    }))
    probes.push({ action, checks, variants })
  }
  return probes
}

function failure(scenario: Scenario, result: ScenarioResult): string {
  if (result.failedStep === undefined) return result.error ?? "unknown error"
  return `step ${result.failedStep} ${JSON.stringify(scenario.steps[result.failedStep])}: ${result.error}`
}
