import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
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
import { PlanSchema, ScenarioSchema, type Plan, type RunConfig } from "../contracts"
import { modelForRound } from "../core/config"
import { initLog } from "../core/log"
import { MockFixtureSchema, MockRunner, type MockFixture } from "../core/runner"
import { board, initializeRuntime, join } from "../core/runtime"
import { createInitialState } from "../core/state"
import { runGates } from "../gatekeeper"
import { scaffold } from "../scaffold"
import { builderBrief, createBuilder, readableSources } from "./builder"

// All tests that need the runtime live in this file: Mozaik allows one runtime per process.

const SECRET = "TAJNI-TEST-NE-SME-DA-PROCURI"
const hasTemplateModules = existsSync("templates/expo/node_modules/typescript")

// Ručno napisan dobar RN ekran liste za kupovinu (isti ugovor o labelama kao na webu).
const GOOD_SCREEN = `import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"

export default function ShoppingList() {
  const [items, setItems] = useState<string[]>([])
  const [name, setName] = useState("")
  return (
    <View>
      <Text role="heading">Lista za kupovinu</Text>
      <TextInput accessibilityLabel="Namirnica" value={name} onChangeText={setName} />
      <Pressable role="button" onPress={() => { setItems([...items, name]); setName("") }}>
        <Text>Dodaj</Text>
      </Pressable>
      {items.length === 0 ? <Text>Lista za kupovinu je prazna</Text> : <Text>Kupljeno: 0 od {items.length}</Text>}
    </View>
  )
}
`

const fixture: MockFixture = {
  // srećan put: original → app → upis → provera → predaja
  "builder:shopping-list:1": [
    { call: { name: "read_source", args: { path: "src/pages/ShoppingListPage.tsx" } } },
    { call: { name: "read_app", args: { path: "." } } },
    { call: { name: "write_file", args: { path: "screens/shopping-list/index.tsx", content: GOOD_SCREEN } } },
    { call: { name: "submit_draft", args: {} } },
    { text: "Submitted the shopping list screen." },
  ],
  // druga runda: vidi svoj nacrt iz prve runde
  "builder:shopping-list:2": [
    { call: { name: "read_app", args: { path: "screens/shopping-list/index.tsx" } } },
    { call: { name: "submit_draft", args: {} } },
    { text: "Fixed." },
  ],
  // upisi van dozvoljenog foldera
  "builder:favorites:1": [
    { call: { name: "write_file", args: { path: "screens/recipe-list/index.tsx", content: "// tuđi ekran" } } },
    { call: { name: "write_file", args: { path: "../../../app/src/screens/favorites/index.tsx", content: "// van staging-a" } } },
    { call: { name: "write_file", args: { path: "/tmp/wemora-builder-escape.tsx", content: "// apsolutna putanja" } } },
    { call: { name: "write_file", args: { path: "screens/favorites/index.tsx", content: "// dozvoljeno" } } },
    { call: { name: "submit_draft", args: {} } },
    { text: "Done." },
  ],
  // pokušaji čitanja testova i tuđih fajlova
  "builder:categories:1": [
    { call: { name: "read_app", args: { path: "../tests/categories.json" } } },
    { call: { name: "read_app", args: { path: "../../tests" } } },
    { call: { name: "read_source", args: { path: "../../../tests/categories.json" } } },
    { call: { name: "read_source", args: { path: "src/pages/RecipeListPage.tsx" } } },
    { text: "Done." },
  ],
  // model zaboravi submit_draft
  "builder:recipe-detail:1": [{ text: "I think I am done." }],
  // dugačka runda koju Conductor prekida
  "builder:recipe-detail:2": [
    { call: { name: "read_app", args: { path: "." } } },
    { call: { name: "read_app", args: { path: "." } } },
    { call: { name: "read_app", args: { path: "." } } },
    { call: { name: "submit_draft", args: {} } },
    { text: "Done." },
  ],
  "builder:recipe-list:1": [{ call: { name: "read_app", args: { path: "." } } }, { text: "Done." }],
  // provera kapija iz alata
  "builder:shopping-list:3": [
    { call: { name: "write_file", args: { path: "screens/shopping-list/index.tsx", content: GOOD_SCREEN } } },
    { call: { name: "check_draft", args: {} } },
    { call: { name: "write_file", args: { path: "screens/shopping-list/index.tsx", content: GOOD_SCREEN.replace('accessibilityLabel="Namirnica"', "") } } },
    { call: { name: "check_draft", args: {} } },
    { call: { name: "write_file", args: { path: "screens/shopping-list/index.tsx", content: GOOD_SCREEN } } },
    { call: { name: "submit_draft", args: {} } },
    { text: "Done." },
  ],
}

// Pamti svaki izlaz alata koji je model video.
class RecordingRunner extends MockRunner {
  toolOutputs: string[] = []
  override async run(input: InferenceInput): Promise<InferenceOutput> {
    for (const item of input.context.getItems()) {
      if (item instanceof FunctionCallOutputItem && !this.toolOutputs.includes(item.output.text)) this.toolOutputs.push(item.output.text)
    }
    return super.run(input)
  }
}

class DraftSubmitted extends SituationSpecification {
  isSatisfiedBy({ event }: SituationContext): boolean {
    return event.type === "draft.submitted"
  }
}

const runner = new RecordingRunner(fixture)
const submitted: { unitId: string; round: number; producerId: string }[] = []
let runDir = ""
let plan: Plan

function waitForSubmit(unitId: string, round: number): Promise<void> {
  const seen = () => submitted.some((s) => s.unitId === unitId && s.round === round)
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (seen()) return resolve()
      if (Date.now() - started > 60_000) return reject(new Error(`no draft.submitted for ${unitId} round ${round}`))
      setTimeout(tick, 20)
    }
    tick()
  })
}

let count = 0
function newBuilder() {
  const builder = createBuilder(`builder-${++count}`)
  join(builder.participant)
  return builder
}

const draftFile = (builderId: string, unitId: string, file: string) => path.join(runDir, "staging", builderId, unitId, file)

beforeAll(async () => {
  runDir = mkdtempSync(path.join(tmpdir(), "wemora-builder-"))
  initLog(runDir)
  plan = PlanSchema.parse(JSON.parse(readFileSync("examples/recepti/wemora/plan.manual.json", "utf8")))
  await scaffold(plan, runDir)
  mkdirSync(path.join(runDir, "tests"), { recursive: true })
  writeFileSync(path.join(runDir, "tests", "categories.json"), JSON.stringify({ secret: SECRET }))

  const config: RunConfig = { webDir: "examples/recepti", runDir, maxBuilders: 2, maxTesters: 1, budgetUsd: 0, mock: true }
  const state = createInitialState("builder-test", config)
  state.plan = plan
  state.tests["shopping-list"] = [
    ScenarioSchema.parse(JSON.parse(readFileSync("src/scenarios/mocks/recepti/add-item.json", "utf8"))),
  ]
  initializeRuntime({ state, inferenceRunnerConfig: { runner } })

  join(
    createHuman({
      name: "listener",
      capabilities: [],
      handlers: [
        {
          specification: new DraftSubmitted(),
          processor: {
            apply: ({ event }) => {
              const { unitId, round } = event.payload as { unitId: string; round: number }
              submitted.push({ unitId, round, producerId: event.producerId })
            },
          },
        },
      ],
    }),
  )
})

describe("builder agent", () => {
  it("čita original i app, piše nacrt u svoj staging i šalje draft.submitted", async () => {
    const builder = newBuilder()
    builder.assign({ unitId: "shopping-list", round: 1, model: modelForRound(1), lastError: null })
    expect(builder.isBusy()).toBe(true)
    await waitForSubmit("shopping-list", 1)

    expect(readFileSync(draftFile(builder.id, "shopping-list", "screens/shopping-list/index.tsx"), "utf8")).toBe(GOOD_SCREEN)
    expect(submitted.find((s) => s.unitId === "shopping-list" && s.round === 1)?.producerId).toBe(builder.participant.getId())
    expect(builder.isBusy()).toBe(false)
    // read_source je vratio original, read_app spisak fajlova aplikacije
    expect(runner.toolOutputs.some((o) => o.includes('<label htmlFor="namirnica">Namirnica</label>'))).toBe(true)
    expect(runner.toolOutputs.some((o) => o.includes("screens/recipe-list/index.tsx") && o.includes("app/_layout.tsx"))).toBe(true)
    // ništa nije upisano u app/
    expect(readFileSync(path.join(runDir, "app/src/screens/shopping-list/index.tsx"), "utf8")).not.toContain("Namirnica")

    // druga runda istog buildera vidi svoj nacrt
    builder.assign({ unitId: "shopping-list", round: 2, model: modelForRound(2), lastError: "labels: nema ..." })
    await waitForSubmit("shopping-list", 2)
    expect(runner.toolOutputs.filter((o) => o === GOOD_SCREEN).length).toBeGreaterThan(0)
  })

  it("upis van staging/<builderId>/<unitId>/ je odbijen (OwnershipGuard)", async () => {
    const builder = newBuilder()
    builder.assign({ unitId: "favorites", round: 1, model: modelForRound(1), lastError: null })
    await waitForSubmit("favorites", 1)

    // sva tri pokušaja dobijaju istu poruku (runner pamti samo različite izlaze)
    expect(runner.toolOutputs).toContain("Rejected: you may only write inside screens/favorites/")
    expect(existsSync(draftFile(builder.id, "favorites", "screens/recipe-list/index.tsx"))).toBe(false)
    expect(readFileSync(path.join(runDir, "app/src/screens/favorites/index.tsx"), "utf8")).not.toContain("van staging-a")
    expect(existsSync("/tmp/wemora-builder-escape.tsx")).toBe(false)
    expect(readFileSync(draftFile(builder.id, "favorites", "screens/favorites/index.tsx"), "utf8")).toBe("// dozvoljeno")
  })

  it("builder ne može da pročita tests/ ni fajlove koji nisu njegov izvor", async () => {
    const builder = newBuilder()
    builder.assign({ unitId: "categories", round: 1, model: modelForRound(1), lastError: null })
    await waitForSubmit("categories", 1)

    expect(runner.toolOutputs.some((o) => o.includes(SECRET))).toBe(false)
    expect(runner.toolOutputs.filter((o) => o.includes("is outside the allowed folder")).length).toBeGreaterThanOrEqual(2)
    expect(runner.toolOutputs.some((o) => o.includes('"src/pages/RecipeListPage.tsx" is not a source of this unit'))).toBe(true)
  })

  it("kad model zaboravi submit_draft, nacrt se ipak predaje (da prolaz ne visi)", async () => {
    const builder = newBuilder()
    builder.assign({ unitId: "recipe-detail", round: 1, model: modelForRound(1), lastError: null })
    await waitForSubmit("recipe-detail", 1)
    expect(builder.isBusy()).toBe(false)
  })

  it("prekinuta runda ne šalje draft.submitted (D-016)", async () => {
    const builder = newBuilder()
    builder.assign({ unitId: "recipe-detail", round: 2, model: modelForRound(2), lastError: null })
    builder.cancel("builder round timeout")
    const started = Date.now()
    while (builder.isBusy() && Date.now() - started < 5_000) await new Promise((r) => setTimeout(r, 10))
    await new Promise((r) => setTimeout(r, 100))
    expect(builder.isBusy()).toBe(false)
    expect(submitted.some((s) => s.unitId === "recipe-detail" && s.round === 2)).toBe(false)
  })

  it("zauzet builder ignoriše drugi zadatak", async () => {
    const builder = newBuilder()
    builder.assign({ unitId: "recipe-list", round: 1, model: modelForRound(1), lastError: null })
    builder.assign({ unitId: "categories", round: 2, model: modelForRound(2), lastError: null })
    await waitForSubmit("recipe-list", 1)
    expect(builder.isBusy()).toBe(false)
    expect(submitted.some((s) => s.unitId === "categories" && s.round === 2)).toBe(false)
  })

  it.skipIf(!hasTemplateModules)("check_draft pušta kapije 1–4 i vraća poruku koju builder razume", async () => {
    const builder = newBuilder()
    builder.assign({ unitId: "shopping-list", round: 3, model: modelForRound(3), lastError: null })
    await waitForSubmit("shopping-list", 3)

    expect(runner.toolOutputs).toContain("All checks passed (parse, forbiddenApis, tsc, labels). Now call submit_draft.")
    const failed = runner.toolOutputs.find((o) => o.startsWith("FAILED at labels"))
    expect(failed).toContain('nema elementa sa accessibilityLabel "Namirnica"')
    // poruka ne otkriva korake testa, samo šta fali
    expect(failed).not.toContain('"value": "Hleb"')
  }, 120_000)
})

describe("tema i izvori zavisnosti (D-027)", () => {
  const withTheme = (): Plan => {
    const theme = { ...plan.units.find((u) => u.id === "data")!, id: "theme", sources: ["src/components/Layout.css"], writes: ["src/shared/theme/"], dependsOn: [] }
    const units = plan.units.map((u) => (u.id === "theme" ? u : { ...u, dependsOn: [...u.dependsOn, "theme"], sources: u.sources.filter((s) => s !== "src/components/Layout.css") }))
    return { ...plan, units: [theme, ...units] }
  }

  it("ekran sme da čita i globalni CSS teme, ali ne i tuđe izvore", () => {
    const p = withTheme()
    const screen = p.units.find((u) => u.id === "favorites")!
    const readable = readableSources(screen, p)
    expect(readable).toContain("src/components/Layout.css")
    expect(readable).toContain("src/pages/FavoritesPage.tsx")
    expect(readable).not.toContain("src/pages/RecipeListPage.tsx")
  })

  it("zadatak ekrana kaže da koristi temu i navodi izvore zavisnosti", () => {
    const p = withTheme()
    const unit = p.units.find((u) => u.id === "favorites")!
    const brief = builderBrief({ unit, round: 1, allowed: ["screens/favorites/"] }, p, null)
    expect(brief).toContain('Theme: import { Text, colors, fonts, fontSizes } from "@/shared/theme"')
    expect(brief).toContain("Also readable with read_source")
    expect(brief).toContain("- src/components/Layout.css")
  })

  it("zadatak teme kaže šta tema pravi; plan bez teme ne pominje temu", () => {
    const p = withTheme()
    const theme = p.units.find((u) => u.id === "theme")!
    expect(builderBrief({ unit: theme, round: 1, allowed: ["shared/theme/"] }, p, null)).toContain("You build the theme")
    // plan.manual.json has a theme since D-027, so the plan without one is made here.
    const noTheme: Plan = { ...plan, units: plan.units.filter((u) => u.id !== "theme").map((u) => ({ ...u, dependsOn: u.dependsOn.filter((d) => d !== "theme") })) }
    const screen = noTheme.units.find((u) => u.id === "favorites")!
    expect(builderBrief({ unit: screen, round: 1, allowed: ["screens/favorites/"] }, noTheme, null)).not.toContain("@/shared/theme")
  })
})

describe("builderBrief", () => {
  it("prva runda: jedinica, rute, izvori, dozvoljene putanje, obaveze", () => {
    const unit = plan.units.find((u) => u.id === "recipe-detail")!
    const brief = builderBrief({ unit, round: 1, allowed: ["screens/recipe-detail/"] }, plan, null)
    expect(brief).toContain("Unit: recipe-detail (screen)")
    expect(brief).toContain("Web route: /recepti/:id")
    expect(brief).toContain("Mobile route: /recepti/[id]")
    expect(brief).toContain("- src/pages/RecipeDetailPage.tsx")
    expect(brief).toContain("- screens/recipe-detail/")
    expect(brief).toContain("Shared units (read them with read_app, import as @/shared/<id>): data, layout")
    expect(brief).toContain("Start with read_source.")
    // spisak postojećih ruta, da builder ne pravi linkove na nepostojeće
    expect(brief).toContain("Mobile routes of the app (link and navigate only to these; you never create routes):")
    for (const r of ["/", "/recepti/[id]", "/kategorije", "/omiljeni", "/kupovina"]) expect(brief).toContain(`- ${r}`)
  })

  it("druga runda nosi poruku Gatekeepera", () => {
    const unit = plan.units.find((u) => u.id === "recipe-detail")!
    const brief = builderBrief({ unit, round: 2, allowed: ["screens/recipe-detail/"] }, plan, 'labels: nema elementa sa accessibilityLabel "Pretraga"')
    expect(brief).toContain("Round: 2")
    expect(brief).toContain('nema elementa sa accessibilityLabel "Pretraga"')
    expect(brief).not.toContain("Start with read_source.")
  })
})

describe("MockRunner primeri za TodoMVC (za A12)", () => {
  const todomvc = MockFixtureSchema.parse(JSON.parse(readFileSync("src/agents/mocks/todomvc/builder.json", "utf8")))
  const written = (key: string) =>
    todomvc[key]!.flatMap((r) => ("call" in r && r.call.name === "write_file" ? [String(r.call.args.content)] : []))

  it("ima app-entry, rundu 1 (pada na kapiji 2), rundu 2 (popravka) i rezervni odgovor", () => {
    expect(Object.keys(todomvc)).toEqual(["builder:theme:1", "builder:app-entry:1", "builder:todo-list:1", "builder:todo-list:2", "builder"])
    // runda 1 uvek pada (ostatak web koda <div> → kapija 2), bez obzira na testove
    expect(written("builder:todo-list:1")[0]).toContain("<div")
    expect(written("builder:todo-list:1")[0]).not.toContain('accessibilityLabel="New Todo Input"')
    expect(written("builder:todo-list:2")[0]).not.toContain("<div")
    expect(written("builder:todo-list:2")[0]).toContain('accessibilityLabel="New Todo Input"')
  })

  it.skipIf(!hasTemplateModules)("tema (builder:theme:1) prolazi kapije 1–4 i nosi vrednosti iz CSS-a", async () => {
    const theme = written("builder:theme:1")[0]!
    for (const v of ["'Helvetica Neue', Helvetica, Arial, sans-serif", "body: 14", "#111111", "#f5f5f5", "#b83f45"]) expect(theme).toContain(v)
    const draftDir = path.join(runDir, "staging", "mock-check", "theme")
    mkdirSync(path.join(draftDir, "shared/theme"), { recursive: true })
    writeFileSync(path.join(draftDir, "shared/theme/index.tsx"), theme)
    const results = await runGates({ draftDir, appDir: path.join(runDir, "app"), tests: [], originalFiles: [] })
    expect(results.map((r) => [r.gate, r.ok, r.ok ? "" : r.message])).toEqual([
      ["parse", true, ""],
      ["forbiddenApis", true, ""],
      ["tsc", true, ""],
      ["labels", true, ""],
    ])
  }, 120_000)

  it.skipIf(!hasTemplateModules)("nacrt za zajedničku jedinicu app-entry prolazi kapije 1–4", async () => {
    const draftDir = path.join(runDir, "staging", "mock-check", "app-entry")
    mkdirSync(path.join(draftDir, "shared/app-entry"), { recursive: true })
    writeFileSync(path.join(draftDir, "shared/app-entry/index.ts"), written("builder:app-entry:1")[0]!)
    const results = await runGates({ draftDir, appDir: path.join(runDir, "app"), tests: [], originalFiles: [] })
    expect(results.every((r) => r.ok)).toBe(true)
  }, 120_000)

  it.skipIf(!hasTemplateModules)("nacrt iz runde 2 prolazi kapije 1–4", async () => {
    const draftDir = path.join(runDir, "staging", "mock-check", "todo-list")
    mkdirSync(path.join(draftDir, "screens/todo-list"), { recursive: true })
    writeFileSync(path.join(draftDir, "screens/todo-list/index.tsx"), written("builder:todo-list:2")[0]!)
    const results = await runGates({ draftDir, appDir: path.join(runDir, "app"), tests: [], originalFiles: [] })
    expect(results.map((r) => [r.gate, r.ok, r.ok ? "" : r.message])).toEqual([
      ["parse", true, ""],
      ["forbiddenApis", true, ""],
      ["tsc", true, ""],
      ["labels", true, ""],
    ])
  }, 120_000)
})
