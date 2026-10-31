import { ScenarioSchema, type RunScenarios, type Scenario, type ScenarioResult, type Step, type ValidateScenario } from "../contracts"
import { runScenarios } from "./run"
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
 */
export function createValidateScenario(run: RunScenarios = runScenarios): ValidateScenario {
  return async (originalUrl, blankUrl, input) => {
    const parsed = ScenarioSchema.safeParse(input)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return { ok: false, reason: `Invalid scenario: ${issue?.path.join(".")}: ${issue?.message}` }
    }
    const scenario = parsed.data
    const probes = actionProbes(scenario)

    // Rule 1 and the rule 3 probes share one browser: the two original runs come first.
    const onOriginal = await run(
      originalUrl,
      [scenario, scenario, ...probes.flatMap((p) => p.variants)],
      { viewport: DESKTOP, differences: [] },
    )
    const [first, second, ...probeResults] = onOriginal
    if (!first.ok) return { ok: false, reason: `Fails on the original web app: ${failure(scenario, first)}` }
    if (!second.ok) {
      return { ok: false, reason: `Unstable: passed once on the original, then failed: ${failure(scenario, second)}` }
    }

    const [onBlank] = await run(blankUrl, [{ ...scenario, setup: undefined }], { viewport: MOBILE, differences: [] })
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

    let next = 0
    for (const probe of probes) {
      const results = probeResults.slice(next, next + probe.variants.length)
      next += probe.variants.length
      if (results.every((r) => r.ok)) {
        const checks = probe.checks.map((i) => `step ${i} ${JSON.stringify(scenario.steps[i])}`).join(", ")
        return {
          ok: false,
          reason:
            `The action at step ${probe.action} (${JSON.stringify(scenario.steps[probe.action])}) changes nothing the scenario checks: ` +
            `without it, every check after it still passes (${checks}). ` +
            `Add a check that is false without the action and true with it. ${CHANGES_NOTHING_HINT}`,
        }
      }
    }
    return { ok: true }
  }
}

export const validateScenario: ValidateScenario = createValidateScenario()

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
