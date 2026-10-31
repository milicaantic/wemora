// Kapija G1, „prvi zajednički test“ (B + C), mali ceo put bez AI-ja:
// scaffold za Recepte → ručno napisan RN ekran ide kroz pravi checkDraft: kapije 1–4 → promote →
// serveApp → B-ov scenario "dodaj namirnicu" (runScenarios, telefon 390×844) prolazi.
// Kontrola: isti scenario pada nad praznim ekranom, pa znamo da stvarno nešto proverava.
// Ovde su i testovi za serveApp: jedna aplikacija, pa se Metro keš zagreva samo jednom (D-009).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PlanSchema, ScenarioSchema, type Scenario } from "../contracts"
import { scaffold } from "../scaffold/index"
import { runScenarios } from "../scenarios/index"
import { checkDraft, serveApp } from "./index"
import { GOOD, SCREEN_FILE } from "./mocks/drafts"

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const hasTemplateModules = existsSync(root("templates/expo/node_modules/expo/bin/cli"))

const PHONE = { width: 390, height: 844 }
const plan = PlanSchema.parse(JSON.parse(readFileSync(root("examples/recepti/wemora/plan.manual.json"), "utf8")))
// B-ov scenario (vlasnik: B), čita se kao podatak.
const addItem: Scenario = ScenarioSchema.parse(
  JSON.parse(readFileSync(root("src/scenarios/mocks/recepti/add-item.json"), "utf8")),
)

describe.skipIf(!hasTemplateModules)("G1: B-ov scenario preko C-ovog serveApp nad ručnim RN ekranom", () => {
  let run: string
  let draftDir: string

  beforeAll(async () => {
    run = mkdtempSync(join(tmpdir(), "wemora-g1-"))
    await scaffold(plan, run)
    draftDir = join(run, "staging", "builder-1", "shopping-list")
    mkdirSync(dirname(join(draftDir, SCREEN_FILE)), { recursive: true })
    writeFileSync(join(draftDir, SCREEN_FILE), GOOD)
  })
  afterAll(() => {
    rmSync(run, { recursive: true, force: true })
  })

  async function runOnApp(): Promise<{ ok: boolean; error?: string }> {
    const app = await serveApp(join(run, "app"))
    try {
      const [result] = await runScenarios(app.url, [addItem], { viewport: PHONE, differences: [] })
      return { ok: result!.ok, error: result!.error }
    } finally {
      await app.close()
    }
  }

  it("serveApp: URL na kome se otvara aplikacija, a posle close() ne ostaje ništa", async () => {
    const app = await serveApp(join(run, "app"))
    const home = await fetch(`${app.url}/`)
    expect(home.status).toBe(200)
    expect(await home.text()).toContain("<html")
    // ruta iz plana radi preko SPA rezerve
    expect((await fetch(`${app.url}/recepti/1`)).status).toBe(200)
    // export nije pisao u app/
    expect(existsSync(join(run, "app/dist"))).toBe(false)
    await app.close()
    await expect(fetch(`${app.url}/`)).rejects.toThrow()
  }, 240_000)

  it("kontrola: nad praznim ekranom iz scaffolda scenario pada", async () => {
    expect((await runOnApp()).ok).toBe(false)
  }, 240_000)

  it("ručni ekran ide kroz pravi checkDraft (kapije 1–5) i ostaje u app/", async () => {
    const results = await checkDraft({
      unit: plan.units.find((u) => u.id === "shopping-list")!,
      round: 1,
      draftDir,
      tests: [addItem],
      webDir: root("examples/recepti"),
    })
    expect(results.find((r) => !r.ok)?.message).toBeUndefined()
    expect(results.map((r) => [r.gate, r.ok])).toEqual([
      ["parse", true],
      ["forbiddenApis", true],
      ["tsc", true],
      ["labels", true],
      ["scenarios", true],
    ])
    expect(readFileSync(join(run, "app/src/screens/shopping-list/index.tsx"), "utf8")).toBe(GOOD)
  }, 240_000)

  // C3.1: regresija i rollback nad pravom aplikacijom i pravim B-ovim testom.
  it("nacrt koji pokvari već dokazan ekran se vraća, a builder dobija listu pokvarenih testova", async () => {
    const layoutBefore = readFileSync(join(run, "app/src/app/_layout.tsx"), "utf8")
    // Realna greška buildera za jedinicu layout: root layout više ne prikazuje ekrane.
    const layoutDraft = join(run, "staging", "builder-2", "layout")
    mkdirSync(join(layoutDraft, "app"), { recursive: true })
    mkdirSync(join(layoutDraft, "shared/layout"), { recursive: true })
    writeFileSync(
      join(layoutDraft, "app/_layout.tsx"),
      'import { Text } from "react-native"\n\nexport default function RootLayout() {\n  return <Text>Recepti</Text>\n}\n',
    )
    writeFileSync(join(layoutDraft, "shared/layout/index.ts"), "export const APP_TITLE = \"Recepti\"\n")

    const results = await checkDraft({
      unit: plan.units.find((u) => u.id === "layout")!,
      round: 1,
      draftDir: layoutDraft,
      tests: [],
      webDir: root("examples/recepti"),
    })

    // kod je ispravan (kapije 1–3), ali kvari ekran koji je već radio
    expect(results.map((r) => [r.gate, r.ok])).toEqual([
      ["parse", true],
      ["forbiddenApis", true],
      ["tsc", true],
      ["regression", false],
    ])
    const regression = results.at(-1)!
    expect(regression.brokenTests).toEqual([addItem.id])
    expect(regression.message).toContain(`test "${addItem.id}" (ekran shopping-list)`)

    // izmena je vraćena: stari layout, bez novih fajlova, a lista za kupovinu i dalje radi
    expect(readFileSync(join(run, "app/src/app/_layout.tsx"), "utf8")).toBe(layoutBefore)
    expect(existsSync(join(run, "app/src/shared/layout/index.ts"))).toBe(false)
    const after = await runOnApp()
    expect(after.error).toBeUndefined()
    expect(after.ok).toBe(true)
  }, 240_000)
})

describe("serveApp bez paketa", () => {
  it("javlja jasnu grešku", async () => {
    await expect(serveApp(join(tmpdir(), "wemora-nema-aplikacije"))).rejects.toThrow("Nema Expo CLI")
  })
})
