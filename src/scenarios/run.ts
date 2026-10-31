import { chromium, errors, type Browser, type BrowserContext, type Locator, type Page } from "playwright"
import { ScenarioSchema, type RunScenarios, type RunScenariosOptions, type Scenario, type ScenarioResult, type Viewport } from "../contracts"
import { compileSteps, describeAction, type Action, type Target } from "./compile"

export type RunnerSettings = {
  stepTimeoutMs: number
  navigationTimeoutMs: number
  /** How long to wait for an element before scrolling down to look for it. */
  scrollGraceMs: number
  maxScrolls: number
  /** expectNotVisible waits until no request has been in flight for this long (the screen may still be loading). */
  networkQuietMs: number
}

// Lives here until it gets a place in core/config.ts (docs/tasks/b.md Q20).
export const DEFAULT_RUNNER_SETTINGS: RunnerSettings = {
  stepTimeoutMs: 5_000,
  navigationTimeoutMs: 15_000,
  scrollGraceMs: 1_000,
  maxScrolls: 20,
  networkQuietMs: 300,
}

type Failure = { step: number; message: string }
type WaitForQuiet = () => Promise<void>

/**
 * Runs scenarios one after another in a fresh browser context each (empty localStorage): setup first, then steps.
 * Never throws. `failedStep` is an index into `steps`; a setup failure has no `failedStep` and its error starts with "setup:".
 * `apiFixture` is not applied yet (docs/tasks/b.md Q1).
 */
export function createRunScenarios(settings: RunnerSettings = DEFAULT_RUNNER_SETTINGS): RunScenarios {
  return async (baseUrl, scenarios, opts) => {
    const started = Date.now()
    let browser: Browser
    try {
      browser = await chromium.launch()
    } catch (err) {
      return scenarios.map((s) => result(s, started, { error: `browser did not start: ${firstLine(err)}` }))
    }
    try {
      const results: ScenarioResult[] = []
      for (const scenario of scenarios) results.push(await runOne(browser, baseUrl, scenario, opts, settings))
      return results
    } finally {
      await browser.close().catch(() => {})
    }
  }
}

export const runScenarios: RunScenarios = createRunScenarios()

async function runOne(
  browser: Browser,
  baseUrl: string,
  input: Scenario,
  opts: RunScenariosOptions,
  settings: RunnerSettings,
): Promise<ScenarioResult> {
  const started = Date.now()
  const parsed = ScenarioSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return result(input, started, { error: `invalid scenario: ${issue?.path.join(".")}: ${issue?.message}` })
  }
  const scenario = parsed.data

  const setup = compileSteps(scenario.setup ?? [], opts.differences)
  if (!setup.ok) return result(scenario, started, { error: `setup: step ${setup.step}: ${setup.error}` })
  const steps = compileSteps(scenario.steps, opts.differences)
  if (!steps.ok) return result(scenario, started, { failedStep: steps.step, error: steps.error })

  let context: BrowserContext | undefined
  try {
    context = await browser.newContext({ viewport: opts.viewport })
    context.setDefaultTimeout(settings.stepTimeoutMs)
    context.setDefaultNavigationTimeout(settings.navigationTimeoutMs)
    const page = await context.newPage()
    const waitForQuiet = trackNetwork(page, settings)
    const run = (actions: Action[]) => runActions(page, baseUrl, opts.viewport, settings, waitForQuiet, actions)

    const setupFailure = await run(setup.actions)
    if (setupFailure) return result(scenario, started, { error: `setup: step ${setupFailure.step}: ${setupFailure.message}` })
    const stepFailure = await run(steps.actions)
    if (stepFailure) return result(scenario, started, { failedStep: stepFailure.step, error: stepFailure.message })
    return result(scenario, started, null)
  } catch (err) {
    return result(scenario, started, { error: firstLine(err) })
  } finally {
    await context?.close().catch(() => {})
  }
}

async function runActions(
  page: Page,
  baseUrl: string,
  viewport: Viewport,
  settings: RunnerSettings,
  waitForQuiet: WaitForQuiet,
  actions: Action[],
): Promise<Failure | null> {
  for (const action of actions) {
    try {
      if (action.kind === "expectNotVisible") await waitForQuiet()
      await perform(page, baseUrl, viewport, settings, action)
    } catch (err) {
      return { step: action.step, message: `${describeAction(action)}: ${explain(err, action, settings)}` }
    }
  }
  return null
}

async function perform(page: Page, baseUrl: string, viewport: Viewport, settings: RunnerSettings, action: Action) {
  switch (action.kind) {
    case "goto":
      await page.goto(joinUrl(baseUrl, action.path))
      return
    case "tap": {
      const el = locate(page, action.target)
      await scrollUntilAttached(page, el, viewport, settings)
      await el.visible().click()
      return
    }
    case "fill": {
      const el = locate(page, action.target)
      await scrollUntilAttached(page, el, viewport, settings)
      await el.visible().fill(action.value)
      return
    }
    case "submit": {
      const el = locate(page, action.target)
      await scrollUntilAttached(page, el, viewport, settings)
      await el.visible().fill(action.value)
      await el.visible().press("Enter")
      return
    }
    case "expectVisible": {
      const text = page.getByText(action.text)
      await scrollUntilAttached(page, text, viewport, settings)
      await text.visible().first().waitFor({ state: "visible" })
      return
    }
    case "expectNotVisible":
      await page.getByText(action.text).visible().first().waitFor({ state: "hidden" })
      return
    case "reveal": {
      const element = locate(page, action.element).visible()
      const reveal = locate(page, action.reveal).visible()
      // Wait until the screen shows one of them, so a page that is still loading is not mistaken for a hidden element.
      await element.or(reveal).first().waitFor({ state: "visible" })
      if ((await element.count()) === 0) await reveal.click()
      return
    }
  }
}

// Roles and names match exactly; tap/fill/submit must resolve to a single visible element (Playwright strict mode).
function locate(page: Page, target: Target): Locator {
  if (target.by === "role") return page.getByRole(target.role as Parameters<Page["getByRole"]>[0], { name: target.name, exact: true })
  if (target.by === "text") return page.getByText(target.text, { exact: true })
  return page.getByLabel(target.label, { exact: true })
}

// React Native Web lists render rows only after scrolling, so an element that is not in the DOM yet is searched for
// by scrolling down step by step. Elements that are already in the DOM are scrolled into view by Playwright itself.
async function scrollUntilAttached(page: Page, locator: Locator, viewport: Viewport, settings: RunnerSettings) {
  const attached = await locator
    .first()
    .waitFor({ state: "attached", timeout: settings.scrollGraceMs })
    .then(() => true, () => false)
  if (attached) return
  await page.mouse.move(viewport.width / 2, viewport.height / 2)
  for (let i = 0; i < settings.maxScrolls; i++) {
    await page.mouse.wheel(0, Math.round(viewport.height * 0.8))
    await page.waitForTimeout(100)
    if ((await locator.count()) > 0) return
  }
}

// "Text is not visible" is trivially true while a screen still shows "Loading…", so it is checked only after
// the network has been quiet for a moment. Gives up silently after one step timeout (e.g. a request that never ends).
function trackNetwork(page: Page, settings: RunnerSettings): WaitForQuiet {
  let inFlight = 0
  let lastActivity = Date.now()
  page.on("request", () => {
    inFlight++
    lastActivity = Date.now()
  })
  const done = () => {
    inFlight = Math.max(0, inFlight - 1)
    lastActivity = Date.now()
  }
  page.on("requestfinished", done)
  page.on("requestfailed", done)

  return async () => {
    const deadline = Date.now() + settings.stepTimeoutMs
    while (Date.now() < deadline) {
      if (inFlight === 0 && Date.now() - lastActivity >= settings.networkQuietMs) return
      await page.waitForTimeout(50)
    }
  }
}

function joinUrl(baseUrl: string, routePath: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${routePath.replace(/^\/+/, "")}`
}

function explain(err: unknown, action: Action, settings: RunnerSettings): string {
  if (!(err instanceof errors.TimeoutError) || action.kind === "goto") return firstLine(err)
  if (action.kind === "expectNotVisible") return `still visible after ${settings.stepTimeoutMs} ms`
  return `not found on screen within ${settings.stepTimeoutMs} ms`
}

function firstLine(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).split("\n")[0]
}

function result(
  scenario: Scenario,
  started: number,
  failure: { failedStep?: number; error: string } | null,
): ScenarioResult {
  return {
    scenarioId: scenario?.id || "<invalid>",
    unitId: scenario?.unitId || "<invalid>",
    ok: failure === null,
    ...(failure?.failedStep !== undefined && { failedStep: failure.failedStep }),
    ...(failure && { error: failure.error }),
    durationMs: Date.now() - started,
  }
}
