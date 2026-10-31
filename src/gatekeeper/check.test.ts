import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanSchema, type CheckDraft, type RunScenarios, type Scenario, type ServeApp, type Unit } from "../contracts"
import { scaffold } from "../scaffold/index"
import { createCheckDraft, PHONE, type CheckDraftWithResults } from "./index"

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
// Kapija 3 (tsc) traži instaliran šablon.
const hasTemplateModules = existsSync(root("templates/expo/node_modules/typescript"))
const WEB_DIR = root("examples/recepti")
const plan = PlanSchema.parse(JSON.parse(readFileSync(root("examples/recepti/wemora/plan.manual.json"), "utf8")))
const unitOf = (id: string): Unit => plan.units.find((u) => u.id === id)!

const SCREEN = `import { Text, View } from "react-native"

export default function Screen() {
  return (
    <View>
      <Text>Lista za kupovinu</Text>
    </View>
  )
}
`
const test = (id: string, unitId: string): Scenario => ({ id, unitId, obligation: id, steps: [{ goto: "/" }] })

let run: string
let app: string
let n = 0
let serveCalls = 0
let runCalls: { url: string; ids: string[]; viewport: unknown }[] = []

// Lažni izvršilac: test prolazi ako ekran njegove jedinice sadrži "// pass:<id>"
// i ako nijedan zajednički deo ne sadrži "// break".
const fakeRun: RunScenarios = async (url, scenarios, opts) => {
  runCalls.push({ url, ids: scenarios.map((s) => s.id), viewport: opts.viewport })
  const broken = existsSync(join(app, "src/shared/data/index.ts")) && readFileSync(join(app, "src/shared/data/index.ts"), "utf8").includes("// break")
  return scenarios.map((s) => {
    const screen = join(app, "src/screens", s.unitId, "index.tsx")
    const ok = !broken && existsSync(screen) && readFileSync(screen, "utf8").includes(`// pass:${s.id}`)
    return ok
      ? { scenarioId: s.id, unitId: s.unitId, ok, durationMs: 1 }
      : { scenarioId: s.id, unitId: s.unitId, ok, durationMs: 1, failedStep: 0, error: 'text "Lista za kupovinu": not found on screen within 5000 ms' }
  })
}
// Lažna dimna provera: aplikacija „puca“ ako neki zajednički deo sadrži "// crash".
let smokeCalls = 0
const fakeSmoke = async () => {
  smokeCalls++
  const crashed = ["data", "layout"].some((u) => existsSync(join(app, "src/shared", u, "index.ts")) && readFileSync(join(app, "src/shared", u, "index.ts"), "utf8").includes("// crash"))
  return crashed ? { ok: false as const, message: "the app crashes on the web: Failed to set an indexed property [0] on 'CSSStyleDeclaration'" } : { ok: true as const }
}

const fakeServe: ServeApp = async () => {
  serveCalls++
  return { url: "http://fake", close: async () => {} }
}

function draft(unitId: string, files: Record<string, string>): string {
  const dir = join(run, "staging", `builder-${++n}`, unitId)
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), c)
  }
  return dir
}

const screenFile = (unitId: string) => readFileSync(join(app, "src/screens", unitId, "index.tsx"), "utf8")
const PLACEHOLDER = () => screenFile("recipe-list") // nijedan test ga ne dira

let checkDraft: CheckDraftWithResults
beforeEach(async () => {
  run = mkdtempSync(join(tmpdir(), "wemora-check-"))
  await scaffold(plan, run)
  app = join(run, "app")
  serveCalls = 0
  runCalls = []
  smokeCalls = 0
  checkDraft = createCheckDraft({ runScenarios: fakeRun, serveApp: fakeServe, smoke: fakeSmoke })
})
afterEach(() => {
  rmSync(run, { recursive: true, force: true })
})

const check = (unitId: string, files: Record<string, string>, tests: Scenario[], round = 1) =>
  checkDraft({ unit: unitOf(unitId), round, draftDir: draft(unitId, files), tests, webDir: WEB_DIR })
const gates = (results: Awaited<ReturnType<CheckDraft>>) => results.map((r) => [r.gate, r.ok])

describe("checkDraft (lažni runScenarios)", () => {
  it("kapija 1 pada: ništa ne ide u app/, nema browsera", async () => {
    const results = await check("shopping-list", { "screens/shopping-list/index.tsx": "export default function S( {" }, [test("sl-1", "shopping-list")])
    expect(gates(results)).toEqual([["parse", false]])
    expect(screenFile("shopping-list")).toBe(PLACEHOLDER())
    expect(serveCalls).toBe(0)
  })

  describe.skipIf(!hasTemplateModules)("sa kapijom 3 (traži instaliran templates/expo)", () => {
    it("dobar ekran: kapije 1–5 prolaze, nacrt ostaje u app/, svaki rezultat ima unitId i rundu", async () => {
      const results = await check("shopping-list", { "screens/shopping-list/index.tsx": `${SCREEN}// pass:sl-1\n` }, [test("sl-1", "shopping-list")], 2)
      expect(gates(results)).toEqual([
        ["parse", true],
        ["forbiddenApis", true],
        ["tsc", true],
        ["labels", true],
        ["scenarios", true],
      ])
      expect(results.every((r) => r.unitId === "shopping-list" && r.round === 2)).toBe(true)
      expect(screenFile("shopping-list")).toContain("// pass:sl-1")
      expect(runCalls).toEqual([{ url: "http://fake", ids: ["sl-1"], viewport: PHONE }])
    }, 60_000)

    it("kapija 5 pada: poruka sa testom i korakom, app/ vraćen", async () => {
      const results = await check("shopping-list", { "screens/shopping-list/index.tsx": SCREEN }, [test("sl-1", "shopping-list")])
      expect(gates(results).at(-1)).toEqual(["scenarios", false])
      expect(results.at(-1)!.message).toContain('- test "sl-1" (ekran shopping-list) na koraku 1: text "Lista za kupovinu": not found')
      expect(screenFile("shopping-list")).toBe(PLACEHOLDER())
    }, 60_000)

    it("regresija: zajednički deo pokvari već promovisan ekran → vraća se, sa brokenTests", async () => {
      await check("shopping-list", { "screens/shopping-list/index.tsx": `${SCREEN}// pass:sl-1\n` }, [test("sl-1", "shopping-list")])
      const results = await check("data", { "shared/data/index.ts": "export const store = {}\n// break\n" }, [])

      expect(gates(results)).toEqual([
        ["parse", true],
        ["forbiddenApis", true],
        ["tsc", true],
        ["scenarios", true],
        ["regression", false],
      ])
      expect(results.at(-1)!.brokenTests).toEqual(["sl-1"])
      expect(results.at(-1)!.message).toContain("pokvario ekrane koji su već radili")
      expect(readdirSync(join(app, "src/shared/data"))).toEqual([".gitkeep"])
      // stari ekran je i dalje tu
      expect(screenFile("shopping-list")).toContain("// pass:sl-1")
    }, 60_000)

    it("zajednička jedinica: kapije 1–3 i dimna provera (aplikacija se otvara), bez sopstvenih UI testova", async () => {
      const results = await check("data", { "shared/data/index.ts": "export const store = {}\n" }, [])
      expect(gates(results)).toEqual([
        ["parse", true],
        ["forbiddenApis", true],
        ["tsc", true],
        ["scenarios", true],
      ])
      expect(results.at(-1)!.message).toContain("opens on the web without errors")
      expect(serveCalls).toBe(1)
      expect(smokeCalls).toBe(1)
      expect(readFileSync(join(app, "src/shared/data/index.ts"), "utf8")).toBe("export const store = {}\n")
    }, 60_000)

    it("zajednička jedinica koja obara aplikaciju pada na dimnoj proveri i vraća se (A → C)", async () => {
      const results = await check("layout", { "shared/layout/index.ts": "export const bar = 1\n// crash\n" }, [])
      expect(gates(results)).toEqual([
        ["parse", true],
        ["forbiddenApis", true],
        ["tsc", true],
        ["scenarios", false],
      ])
      expect(results.at(-1)!.message).toContain("the app crashes on the web: Failed to set an indexed property")
      expect(results.at(-1)!.message).toContain("every screen is rendered inside it")
      expect(readdirSync(join(app, "src/shared/layout"))).toEqual([".gitkeep"])
    }, 60_000)

    it("ekran bez testova ulazi kao nedokazan (bez browsera)", async () => {
      const results = await check("favorites", { "screens/favorites/index.tsx": SCREEN }, [])
      expect(results.at(-1)).toMatchObject({ gate: "scenarios", ok: true })
      expect(results.at(-1)!.message).toContain("nedokazan")
      expect(serveCalls).toBe(0)
      expect(screenFile("favorites")).toBe(SCREEN)
    }, 60_000)

    it("aplikacija ne može da se pokrene: kapija 5 pada i nacrt se vraća", async () => {
      checkDraft = createCheckDraft({
        runScenarios: fakeRun,
        serveApp: async () => {
          throw new Error("Web export aplikacije nije uspeo")
        },
      })
      const results = await check("shopping-list", { "screens/shopping-list/index.tsx": `${SCREEN}// pass:sl-1\n` }, [test("sl-1", "shopping-list")])
      expect(results.at(-1)).toMatchObject({ gate: "scenarios", ok: false })
      expect(results.at(-1)!.message).toContain("aplikacija nije mogla da se pokrene")
      expect(screenFile("shopping-list")).toBe(PLACEHOLDER())
    }, 60_000)

    it("pamti rezultat svakog testa iz kapije 5, i kad prolazi i kad pada (results/<unit>.json, D → C)", async () => {
      const tests = [test("sl-1", "shopping-list"), test("sl-2", "shopping-list")]
      // sl-2 pada (nema "// pass:sl-2" u ekranu)
      await check("shopping-list", { "screens/shopping-list/index.tsx": `${SCREEN}// pass:sl-1\n` }, tests)
      expect(checkDraft.scenariosOf("shopping-list")).toEqual([
        { scenarioId: "sl-1", unitId: "shopping-list", ok: true, durationMs: 1 },
        { scenarioId: "sl-2", unitId: "shopping-list", ok: false, durationMs: 1, failedStep: 0, error: 'text "Lista za kupovinu": not found on screen within 5000 ms' },
      ])
      // sledeća provera iste jedinice briše stare rezultate (kapija 1 pada, kapija 5 se ne pušta)
      await check("shopping-list", { "screens/shopping-list/index.tsx": "export default function S( {" }, tests)
      expect(checkDraft.scenariosOf("shopping-list")).toEqual([])
    }, 60_000)

    it("regresija pušta testove svih već promovisanih ekrana", async () => {
      await check("shopping-list", { "screens/shopping-list/index.tsx": `${SCREEN}// pass:sl-1\n` }, [test("sl-1", "shopping-list")])
      runCalls = []
      const results = await check("favorites", { "screens/favorites/index.tsx": `${SCREEN}// pass:fav-1\n` }, [test("fav-1", "favorites")])
      expect(gates(results).slice(-2)).toEqual([
        ["scenarios", true],
        ["regression", true],
      ])
      expect(runCalls.map((c) => c.ids)).toEqual([["fav-1"], ["sl-1"]])
      expect(serveCalls).toBe(2) // jedan export po proveri, ne po testu
    }, 60_000)
  })
})
