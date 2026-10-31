

import { readdirSync, readFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PlanSchema, ScenarioSchema, type Scenario, type ServedApp } from "../contracts"
import { createRunScenarios } from "./run"
import { serveStatic } from "./serve"
import { createValidateScenario } from "./validate"

const run = createRunScenarios({
  stepTimeoutMs: 1_500,
  navigationTimeoutMs: 5_000,
  scrollGraceMs: 300,
  maxScrolls: 5,
  networkQuietMs: 300,
})
const validateScenario = createValidateScenario(run)
const mocks = (dir: string) => fileURLToPath(new URL(`./mocks/${dir}`, import.meta.url))

const scenario = (id: string, steps: Scenario["steps"], extra: Partial<Scenario> = {}): Scenario => ({
  id,
  unitId: "narudzbine",
  obligation: "pretraga",
  steps,
  ...extra,
})

let original: ServedApp
let blank: ServedApp

beforeAll(async () => {
  original = await serveStatic(mocks("static"))
  blank = await serveStatic(mocks("blank"))
})

afterAll(async () => {
  await Promise.all([original.close(), blank.close()])
})

describe("validateScenario", { timeout: 60_000 }, () => {
  it("accepts a scenario where each action changes at least one check (wemora-plan.md §4.1)", async () => {
    // "#1042" is visible before the search too; "#1043" is what the search changes.
    const search = scenario("search", [
      { goto: "/" },
      { fill: { label: "Pretraga", value: "Petar" } },
      { expectVisible: { text: "#1042" } },
      { expectNotVisible: { text: "#1043" } },
    ])
    expect(await validateScenario(original.url, blank.url, search)).toEqual({ ok: true })
  })

  it("rejects a scenario that fails on the original and names the step", async () => {
    const wrong = scenario("wrong", [{ goto: "/" }, { expectVisible: { text: "#9999" } }])
    const result = await validateScenario(original.url, blank.url, wrong)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/^Fails on the original web app: step 1/)
  })

  it("rejects a scenario that passes on the blank screen", async () => {
    const titleOnly = scenario("title", [{ goto: "/" }, { expectVisible: { text: "Narudžbine" } }])
    const result = await validateScenario(original.url, blank.url, titleOnly)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("blank placeholder screen")
  })

  it("skips setup on the blank screen, so a failing setup does not count as a real failure", async () => {
    const titleAfterSetup = scenario("title-after-setup", [{ goto: "/" }, { expectVisible: { text: "Narudžbine" } }], {
      setup: [{ goto: "/" }, { tap: { role: "button", name: "Dodaj u omiljene" } }],
    })
    const result = await validateScenario(original.url, blank.url, titleAfterSetup)
    expect(result.reason).toContain("blank placeholder screen")
  })

  it("rejects an action whose checks all pass before it", async () => {
    const noEffect = scenario("no-effect", [
      { goto: "/" },
      { tap: { role: "button", name: "Sačuvaj" } },
      { expectVisible: { text: "Pretraga" } },
    ])
    const result = await validateScenario(original.url, blank.url, noEffect)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("The action at step 1")
    expect(result.reason).toContain('step 2 {"expectVisible":{"text":"Pretraga"}}')
    // The hint for the usual mistakes, so the tester does not spend all its attempts on one.
    expect(result.reason).toContain("check that this screen is gone")
    expect(result.reason).toContain("never check a text of the other screen")
  })

  it("keeps the goto between an action and its check: the check runs on the screen it was written for", async () => {
    // index.html shows #1042 anyway; omiljeni.html lists it only after "Dodaj u omiljene". Run before the tap,
    // the check would land on index.html and pass, so the scenario used to be refused by mistake.
    const addThenOpen = scenario("add-then-open-favorites", [
      { goto: "/" },
      { tap: { role: "button", name: "Dodaj u omiljene" } },
      { goto: "/omiljeni.html" },
      { expectVisible: { text: "#1042 Petar" } },
    ])
    expect(await validateScenario(original.url, blank.url, addThenOpen)).toEqual({ ok: true })

    // Opening the favorites screen and checking a text that is there either way still changes nothing.
    const nothing = scenario("open-favorites-heading", [
      { goto: "/" },
      { tap: { role: "button", name: "Dodaj u omiljene" } },
      { goto: "/omiljeni.html" },
      { expectVisible: { text: "Omiljene narudžbine" } },
    ])
    const result = await validateScenario(original.url, blank.url, nothing)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("changes nothing the scenario checks")
  })

  it("treats submit as an action for rule 3 (D-017)", async () => {
    const adds = scenario("adds-task", [
      { goto: "/zadaci.html" },
      { submit: { label: "Nov zadatak", value: "Kupi mleko" } },
      { expectVisible: { text: "Kupi mleko" } },
    ])
    expect(await validateScenario(original.url, blank.url, adds)).toEqual({ ok: true })

    const noEffect = scenario("submit-no-effect", [
      { goto: "/zadaci.html" },
      { submit: { label: "Nov zadatak", value: "Kupi mleko" } },
      { expectVisible: { text: "Zadaci" } },
    ])
    const result = await validateScenario(original.url, blank.url, noEffect)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain("The action at step 1")
  })

  it("rejects an unstable scenario", async () => {
    // Serves "Prvi" on the first page load and "Drugi" afterwards.
    let loads = 0
    const server: Server = createServer((req, res) => {
      if (req.url !== "/") return void res.writeHead(404).end()
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      res.end(`<h1>${loads++ === 0 ? "Prvi" : "Drugi"}</h1>`)
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      const result = await validateScenario(url, blank.url, scenario("flaky", [{ goto: "/" }, { expectVisible: { text: "Prvi" } }]))
      expect(result.ok).toBe(false)
      expect(result.reason).toMatch(/^Unstable/)
    } finally {
      server.closeAllConnections()
      server.close()
    }
  })

  it("reports a blank screen that does not load instead of accepting the scenario", async () => {
    const stopped = await serveStatic(mocks("blank"))
    await stopped.close()
    const search = scenario("search", [
      { goto: "/" },
      { fill: { label: "Pretraga", value: "Petar" } },
      { expectNotVisible: { text: "#1043" } },
    ])
    const result = await validateScenario(original.url, stopped.url, search)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/^Blank screen did not load/)
  })

  it("rejects an invalid scenario", async () => {
    const invalid = { ...scenario("x", [{ goto: "/" }]), steps: [] }
    const result = await validateScenario(original.url, blank.url, invalid)
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/^Invalid scenario: steps/)
  })
})

// The hand-written Recepti scenarios run against the real app only by hand (G1); here only their shape is checked.
describe("Recepti manual scenarios", () => {
  const plan = PlanSchema.parse(
    JSON.parse(readFileSync(new URL("../../examples/recepti/wemora/plan.manual.json", import.meta.url), "utf8")),
  )
  const files = readdirSync(mocks("recepti")).filter((f) => f.endsWith(".json"))

  it.each(files)("%s is a valid scenario for a unit and obligation of the plan", (file) => {
    const s = ScenarioSchema.parse(JSON.parse(readFileSync(`${mocks("recepti")}/${file}`, "utf8")))
    const unit = plan.units.find((u) => u.id === s.unitId)
    expect(unit?.obligations.map((o) => o.id)).toContain(s.obligation)
  })
})
