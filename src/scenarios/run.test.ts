import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { IntentionalDifference, Scenario, ServedApp } from "../contracts"
import { createRunScenarios } from "./run"
import { serveStatic } from "./serve"

// Real Chromium against a local static server; no internet. Short timeouts keep failing cases fast.
const runScenarios = createRunScenarios({ stepTimeoutMs: 1_500, navigationTimeoutMs: 5_000, scrollGraceMs: 300, maxScrolls: 30 })

const desktop = { viewport: { width: 1280, height: 800 }, differences: [] }
const mobile = { viewport: { width: 390, height: 844 }, differences: [] }
const filtersHidden: IntentionalDifference = {
  kind: "hiddenBehind",
  element: { label: "Status" },
  reveal: { role: "button", name: "Filteri" },
}

const scenario = (id: string, steps: Scenario["steps"], extra: Partial<Scenario> = {}): Scenario => ({
  id,
  unitId: "narudzbine",
  obligation: "pretraga",
  steps,
  ...extra,
})

const search = scenario("search", [
  { goto: "/" },
  { fill: { label: "Pretraga", value: "Petar" } },
  { expectVisible: { text: "#1042" } },
  { expectNotVisible: { text: "#1043" } },
])

const statusFilter = scenario("status", [
  { goto: "/" },
  { fill: { label: "Status", value: "Poslato" } },
  { expectNotVisible: { text: "#1043" } },
])

let app: ServedApp

beforeAll(async () => {
  app = await serveStatic(fileURLToPath(new URL("./mocks/static", import.meta.url)))
})

afterAll(async () => {
  await app.close()
})

describe("runScenarios", { timeout: 60_000 }, () => {
  it("passes a correct scenario", async () => {
    const [result] = await runScenarios(app.url, [search], desktop)
    expect(result).toMatchObject({ scenarioId: "search", unitId: "narudzbine", ok: true })
    expect(result.failedStep).toBeUndefined()
  })

  it("reports the failing step with a message that names the missing label", async () => {
    const wrongLabel = scenario("wrong-label", [{ goto: "/" }, { fill: { label: "Traži", value: "Petar" } }])
    const [result] = await runScenarios(app.url, [wrongLabel], desktop)
    expect(result).toMatchObject({ ok: false, failedStep: 1 })
    expect(result.error).toContain('field labelled "Traži"')
    expect(result.error).toContain("not found on screen")
  })

  it("uses the requested viewport", async () => {
    const width = (w: number) => scenario(`width-${w}`, [{ goto: "/" }, { expectVisible: { text: `Širina: ${w}` } }])
    const [onDesktop] = await runScenarios(app.url, [width(1280)], desktop)
    const [onMobile] = await runScenarios(app.url, [width(390)], mobile)
    expect([onDesktop.ok, onMobile.ok]).toEqual([true, true])
  })

  it("runs setup before steps and gives every scenario a fresh localStorage", async () => {
    const withSetup = scenario("with-setup", [{ goto: "/" }, { expectVisible: { text: "Omiljeni: 1" } }], {
      setup: [{ goto: "/" }, { tap: { role: "button", name: "Dodaj u omiljene" } }],
    })
    const fresh = scenario("fresh", [{ goto: "/" }, { expectVisible: { text: "Omiljeni: 0" } }])
    const results = await runScenarios(app.url, [withSetup, fresh], desktop)
    expect(results.map((r) => r.ok)).toEqual([true, true])
  })

  it("reports a setup failure without failedStep", async () => {
    const brokenSetup = scenario("broken-setup", [{ goto: "/" }], { setup: [{ goto: "/" }, { tap: { text: "Nema me" } }] })
    const [result] = await runScenarios(app.url, [brokenSetup], desktop)
    expect(result.ok).toBe(false)
    expect(result.failedStep).toBeUndefined()
    expect(result.error).toMatch(/^setup: step 1: tap text "Nema me"/)
  })

  it("reveals an element hidden behind a button on mobile", async () => {
    const [withoutReveal] = await runScenarios(app.url, [statusFilter], mobile)
    const [withReveal] = await runScenarios(app.url, [statusFilter], { ...mobile, differences: [filtersHidden] })
    expect(withoutReveal).toMatchObject({ ok: false, failedStep: 1 })
    expect(withReveal.ok).toBe(true)
  })

  it("does not tap reveal when the element is already visible", async () => {
    // On desktop the filters are always shown and there is no "Filteri" button to tap.
    const [result] = await runScenarios(app.url, [statusFilter], { ...desktop, differences: [filtersHidden] })
    expect(result.ok).toBe(true)
  })

  it("rejects a step on a notPortable element", async () => {
    const hover: IntentionalDifference = { kind: "notPortable", element: { role: "button", name: "Sačuvaj" }, reason: "hover only" }
    const save = scenario("save", [{ goto: "/" }, { tap: { role: "button", name: "Sačuvaj" } }])
    const [result] = await runScenarios(app.url, [save], { ...mobile, differences: [hover] })
    expect(result).toMatchObject({ ok: false, failedStep: 1 })
    expect(result.error).toContain("notPortable")
  })

  it("scrolls a virtualized list until the row is rendered", async () => {
    const row = scenario("row", [{ goto: "/lista.html" }, { expectVisible: { text: "Stavka 150" } }])
    const [result] = await runScenarios(app.url, [row], mobile)
    expect(result.ok).toBe(true)
  })

  it("rejects an invalid scenario without running it", async () => {
    const invalid = { ...search, steps: [{ click: { text: "Sačuvaj" } }] } as unknown as Scenario
    const [result] = await runScenarios(app.url, [invalid], desktop)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/^invalid scenario/)
  })

  it("never throws when the app is not running", async () => {
    const stopped = await serveStatic(fileURLToPath(new URL("./mocks/static", import.meta.url)))
    await stopped.close()
    const results = await runScenarios(stopped.url, [search, statusFilter], desktop)
    expect(results.map((r) => r.ok)).toEqual([false, false])
    expect(results[0].error).toContain("ERR_CONNECTION_REFUSED")
  })
})
