import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createHuman,
  FunctionCallOutputItem,
  SituationSpecification,
  type InferenceInput,
  type InferenceOutput,
  type SituationContext,
} from "@mozaik-ai/core"
import { beforeAll, describe, expect, it } from "vitest"
import type { Plan, RunConfig, Scenario, Unit, ValidateScenario } from "../contracts"
import { initLog } from "../core/log"
import { MockRunner, type MockFixture } from "../core/runner"
import { board, initializeRuntime, join } from "../core/runtime"
import { createInitialState } from "../core/state"
import { readTests } from "../scenarios"
import { createTester } from "./tester"

// All tests that need the runtime live in this file: Mozaik allows one runtime per process.

const unit = (id: string, extra: Partial<Unit> = {}): Unit => ({
  id,
  kind: "screen",
  wave: 1,
  route: "/narudzbine",
  sources: ["src/pages/Orders.tsx"],
  writes: [`src/screens/${id}/`],
  dependsOn: [],
  obligations: [
    { id: "search", description: "Typing 'Petar' in 'Pretraga' hides #1043" },
    { id: "save", description: "'Sačuvaj' shows 'Sačuvano'" },
  ],
  intentionalDifferences: [{ kind: "notPortable", element: { role: "button", name: "Info" }, reason: "hover only" }],
  size: 1000,
  ...extra,
})

const search = (unitId: string): Scenario => ({
  id: `${unitId}-search`,
  unitId,
  obligation: "search",
  steps: [{ goto: "/narudzbine" }, { fill: { label: "Pretraga", value: "Petar" } }, { expectNotVisible: { text: "#1043" } }],
})
const save = (unitId: string): Scenario => ({
  id: `${unitId}-save`,
  unitId,
  obligation: "save",
  steps: [{ goto: "/narudzbine" }, { tap: { role: "button", name: "Sačuvaj" } }, { expectVisible: { text: "Sačuvano" } }],
})
const call = (name: string, args: Record<string, unknown>) => ({ call: { name, args } })
const saveCall = (scenario: Scenario) => call("save_scenario", { scenario })

const fixture: MockFixture = {
  "tester:u-full": [
    call("aria_snapshot", { path: "/narudzbine" }),
    // Fails validateScenario (the fake rejects ids starting with "bad").
    saveCall({ ...search("u-full"), id: "bad-search" }),
    call("try_scenario", { scenario: search("u-full") }),
    saveCall(search("u-full")),
    saveCall({ ...save("u-full"), unitId: "other" }),
    saveCall({ ...save("u-full"), obligation: "nope" }),
    saveCall({ ...save("u-full"), id: "u-full-info", steps: [{ goto: "/narudzbine" }, { tap: { role: "button", name: "Info" } }] }),
    saveCall(save("u-full")),
    { text: "Saved one scenario for each obligation." },
  ],
  "tester:u-partial": [saveCall(search("u-partial")), { text: "Saved what I could." }],
  "tester:u-none": [{ text: "Nothing to test." }],
  "tester:u-existing": [saveCall(save("u-existing")), { text: "Added the missing obligation." }],
  "tester:u-busy": [saveCall(search("u-busy")), { text: "Done." }],
  "tester:u-cancel": [call("aria_snapshot", { path: "/narudzbine" }), saveCall(search("u-cancel")), { text: "Done." }],
  "tester:u-blank": [saveCall(search("u-blank")), { text: "Done." }],
  "tester:u-blank-down": [saveCall(search("u-blank-down")), { text: "Done." }],
}

// Keeps every tool output the model saw, so tests can check what came back from a tool.
class RecordingRunner extends MockRunner {
  toolOutputs: string[] = []
  override async run(input: InferenceInput): Promise<InferenceOutput> {
    for (const item of input.context.getItems()) {
      if (item instanceof FunctionCallOutputItem && !this.toolOutputs.includes(item.output.text)) this.toolOutputs.push(item.output.text)
    }
    return super.run(input)
  }
}

class TestsReady extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "tests.ready"
  }
}

const runner = new RecordingRunner(fixture)
const ready: string[] = []
const validated: string[] = []
const blanks: string[] = []
let runDir = ""

// No browser: a scenario is valid unless its id starts with "bad".
const fakeValidate: ValidateScenario = async (_original, blank, scenario) => {
  validated.push(scenario.id)
  blanks.push(blank)
  return scenario.id.startsWith("bad") ? { ok: false, reason: "Passes on the blank placeholder screen too." } : { ok: true }
}

let count = 0
function newTester(blankUrl: string | (() => Promise<string>) = "http://blank.test") {
  const tester = createTester(`tester-${++count}`, {
    originalUrl: "http://original.test",
    blankUrl,
    validateScenario: fakeValidate,
    extractInteractive: async () => [
      { role: "searchbox", name: "Pretraga" },
      { role: "button", name: "Sačuvaj" },
      { role: "button", name: "Info" },
    ],
    ariaSnapshot: async (_url, route) => `- searchbox "Pretraga"\n- button "Sačuvaj"\n# snapshot of ${route}`,
  })
  join(tester.participant)
  return tester
}

async function untilIdle(tester: { isBusy(): boolean }): Promise<void> {
  for (let i = 0; i < 200 && tester.isBusy(); i++) await new Promise((r) => setTimeout(r, 25))
  if (tester.isBusy()) throw new Error("tester is still busy")
  // tests.ready is sent right after the tester becomes free.
  await new Promise((r) => setTimeout(r, 25))
}

const logLines = () =>
  readFileSync(path.join(runDir, "run.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { event: string; data?: { unitId?: string } })

beforeAll(() => {
  runDir = mkdtempSync(path.join(tmpdir(), "wemora-tester-"))
  initLog(runDir)
  const ids = ["u-full", "u-partial", "u-none", "u-existing", "u-busy", "u-cancel", "u-blank", "u-blank-down"]
  const plan: Plan = {
    units: [...ids.map((id) => unit(id)), unit("shared-data", { kind: "shared", route: undefined, obligations: [] })],
    flows: [],
    routeMap: { "/narudzbine": "/narudzbine" },
  }
  const config: RunConfig = { webDir: "examples/recepti", runDir, maxBuilders: 1, maxTesters: 1, budgetUsd: 0, mock: true }
  const state = createInitialState("tester-test", config)
  state.plan = plan
  initializeRuntime({ state, inferenceRunnerConfig: { runner } })

  join(
    createHuman({
      name: "listener",
      capabilities: [],
      handlers: [
        {
          specification: new TestsReady(),
          processor: { apply: ({ event }) => void ready.push((event.payload as { unitId: string }).unitId) },
        },
      ],
    }),
  )
})

describe("tester agent", () => {
  it("saves only scenarios that pass every check, writes tests/<unitId>.json and sends tests.ready once", async () => {
    const tester = newTester()
    tester.assign({ unitId: "u-full" })
    expect(tester.isBusy()).toBe(true)
    await untilIdle(tester)

    expect(readTests(runDir, "u-full").map((s) => s.id)).toEqual(["u-full-search", "u-full-save"])
    expect(board().tests["u-full"]?.map((s) => s.id)).toEqual(["u-full-search", "u-full-save"])
    expect(ready.filter((u) => u === "u-full")).toHaveLength(1)
  })

  it("tells the model why a scenario was refused, and what is still missing after a save", () => {
    const outputs = runner.toolOutputs.join("\n")
    expect(outputs).toContain("# snapshot of /narudzbine")
    expect(outputs).toContain("Not saved: Passes on the blank placeholder screen too.")
    expect(outputs).toContain("Valid. Call save_scenario")
    expect(outputs).toContain('Not saved: unitId must be "u-full", not "other".')
    expect(outputs).toContain('Not saved: Unknown obligation "nope"')
    expect(outputs).toContain('button "Info", which does not exist on mobile')
    expect(outputs).toContain('Saved "u-full-search". Obligations still without a scenario: save.')
    expect(outputs).toContain('Saved "u-full-save". All obligations and interactive elements are covered.')
  })

  it("does not validate a scenario again after try_scenario, nor one refused by the cheap checks", () => {
    expect(validated.filter((id) => id.startsWith("bad") || id.startsWith("u-full"))).toEqual(["bad-search", "u-full-search", "u-full-save"])
  })

  it("sends tests.ready with partial tests when the model stops early", async () => {
    const tester = newTester()
    tester.assign({ unitId: "u-partial" })
    await untilIdle(tester)
    expect(readTests(runDir, "u-partial")).toHaveLength(1)
    expect(ready.filter((u) => u === "u-partial")).toHaveLength(1)
  })

  it("sends nothing when no scenario was saved, and logs it", async () => {
    const tester = newTester()
    tester.assign({ unitId: "u-none" })
    await untilIdle(tester)
    expect(ready).not.toContain("u-none")
    expect(logLines().some((l) => l.event === "tests.none" && l.data?.unitId === "u-none")).toBe(true)
  })

  it("continues from the scenarios a previous tester saved", async () => {
    board().tests["u-existing"] = [search("u-existing")]
    const tester = newTester()
    tester.assign({ unitId: "u-existing" })
    await untilIdle(tester)
    expect(readTests(runDir, "u-existing").map((s) => s.id)).toEqual(["u-existing-search", "u-existing-save"])
  })

  it("ignores a second task while busy", async () => {
    const tester = newTester()
    tester.assign({ unitId: "u-busy" })
    tester.assign({ unitId: "u-partial" })
    await untilIdle(tester)
    expect(ready.filter((u) => u === "u-busy")).toHaveLength(1)
    expect(ready.filter((u) => u === "u-partial")).toHaveLength(1)
    expect(logLines().some((l) => l.event === "task.ignored" && l.data?.unitId === "u-partial")).toBe(true)
  })

  it("on cancel ends the loop before saving and becomes free", async () => {
    const tester = newTester()
    tester.assign({ unitId: "u-cancel" })
    tester.cancel("timeout")
    await untilIdle(tester)
    expect(readTests(runDir, "u-cancel")).toEqual([])
    expect(ready).not.toContain("u-cancel")
  })

  it("takes the blank screen URL from a function (blankApp in a run) and validates against it", async () => {
    let calls = 0
    const tester = newTester(async () => {
      calls++
      return "http://scaffold-placeholder.test"
    })
    tester.assign({ unitId: "u-blank" })
    await untilIdle(tester)
    expect(calls).toBe(1)
    expect(blanks.at(-1)).toBe("http://scaffold-placeholder.test")
    expect(ready).toContain("u-blank")
  })

  it("stops the task before asking the model when the blank screen cannot be served", async () => {
    const tester = newTester(async () => {
      throw new Error("web export failed")
    })
    tester.assign({ unitId: "u-blank-down" })
    await untilIdle(tester)
    expect(readTests(runDir, "u-blank-down")).toEqual([])
    expect(ready).not.toContain("u-blank-down")
    const failed = logLines().find((l) => l.event === "tester.failed" && l.data?.unitId === "u-blank-down")
    expect(JSON.stringify(failed)).toContain("web export failed")
  })

  it("refuses a unit that is not in the plan or is not a screen, without hanging", async () => {
    for (const unitId of ["missing", "shared-data"]) {
      const tester = newTester()
      tester.assign({ unitId })
      await untilIdle(tester)
      expect(ready).not.toContain(unitId)
    }
    const failed = logLines().filter((l) => l.event === "tester.failed").map((l) => l.data?.unitId)
    expect(failed).toEqual(expect.arrayContaining(["missing", "shared-data"]))
  })
})
