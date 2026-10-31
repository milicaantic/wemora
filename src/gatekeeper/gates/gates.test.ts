import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PlanSchema, ScenarioSchema } from "../../contracts"
import { scaffold } from "../../scaffold/index"
import * as drafts from "../mocks/drafts"
import { forbiddenApisGate, runGates, type GateCheck, type GateInput } from "./index"

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url))
const PLAN = PlanSchema.parse(JSON.parse(readFileSync(root("examples/recepti/wemora/plan.manual.json"), "utf8")))
const TESTS = ScenarioSchema.array().parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../mocks/shopping-list.tests.json", import.meta.url)), "utf8")),
)
const ORIGINAL = [root("examples/recepti/src/pages/ShoppingListPage.tsx")]
// Kapija 3 traži instaliran šablon (npm install u templates/expo).
const hasTemplateModules = existsSync(root("templates/expo/node_modules/typescript"))

let tmp: string
let appDir: string
let n = 0

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), "wemora-gates-"))
  await scaffold(PLAN, tmp)
  appDir = join(tmp, "app")
})
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function draft(files: Record<string, string>): string {
  const dir = join(tmp, "staging", `draft-${++n}`)
  for (const [path, code] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), code)
  }
  return dir
}

const input = (code: string): GateInput => ({
  draftDir: draft({ [drafts.SCREEN_FILE]: code }),
  appDir,
  tests: TESTS,
  originalFiles: ORIGINAL,
})

const last = (results: GateCheck[]) => results[results.length - 1]!

describe("kapija 1: parse", () => {
  it("loš nacrt pada baš na parse, sa fajlom i linijom", async () => {
    const results = await runGates(input(drafts.BAD_PARSE))
    expect(results).toHaveLength(1)
    expect(last(results)).toMatchObject({ gate: "parse", ok: false })
    expect(last(results).message).toMatch(/screens\/shopping-list\/index\.tsx:12: '\)' expected/)
  })

  it("prazan nacrt pada na parse", async () => {
    const results = await runGates({ ...input(drafts.GOOD), draftDir: draft({}) })
    expect(last(results)).toMatchObject({ gate: "parse", ok: false })
    expect(last(results).message).toContain("prazan")
  })
})

describe("kapija 2: forbiddenApis", () => {
  it("loš nacrt pada baš na forbiddenApis, sa predlogom zamene", async () => {
    const results = await runGates(input(drafts.BAD_FORBIDDEN))
    expect(results.map((r) => r.gate)).toEqual(["parse", "forbiddenApis"])
    expect(last(results).ok).toBe(false)
    expect(last(results).message).toContain("screens/shopping-list/index.tsx:19: <div> ne postoji u React Native, koristi <View>")
    expect(last(results).message).toContain("nema `localStorage` na telefonu")
  })

  it("hvata zabranjene uvoze", async () => {
    const r = await forbiddenApisGate(input(`import { Link } from "react-router-dom"\nimport { createRoot } from "react-dom/client"\n`))
    expect(r.ok).toBe(false)
    expect(r.message).toContain(':1: uvoz "react-router-dom"')
    expect(r.message).toContain(':2: uvoz "react-dom/client"')
  })

  it("ne smeta reč window/document kad nije globalna promenljiva", async () => {
    const code = `const o = { window: 1, document: "x" }\nexport const w = o.window + o.document\nexport const t = "window i localStorage"\n`
    expect((await forbiddenApisGate(input(code))).ok).toBe(true)
  })
})

describe.skipIf(!hasTemplateModules)("kapije 3 i 4 (traže instaliran templates/expo)", () => {
  it("dobar nacrt prolazi sve 4 kapije", async () => {
    const results = await runGates(input(drafts.GOOD))
    expect(results.map((r) => [r.gate, r.ok])).toEqual([
      ["parse", true],
      ["forbiddenApis", true],
      ["tsc", true],
      ["labels", true],
    ])
    // "Hleb" i "Kupljeno: 0 od 1" nema u originalu (podaci), pa se preskaču
    expect(last(results).message).toBe("Pronađeno 3 labela/tekstova; preskočeno 2 (dolaze iz podataka, nema ih u originalu).")
  }, 60_000)

  it("kapija 3: loš nacrt pada baš na tsc, sa fajlom, linijom i greškom", async () => {
    const results = await runGates(input(drafts.BAD_TSC))
    expect(results.map((r) => r.gate)).toEqual(["parse", "forbiddenApis", "tsc"])
    expect(last(results).ok).toBe(false)
    expect(last(results).message).toMatch(/screens\/shopping-list\/index\.tsx:31: TS2339: Property 'title' does not exist/)
  }, 60_000)

  it("kapija 4: promenjena labela polja", async () => {
    const results = await runGates(input(drafts.BAD_LABEL))
    expect(last(results)).toMatchObject({ gate: "labels", ok: false })
    expect(last(results).message).toContain('nema elementa sa accessibilityLabel "Namirnica"')
    expect(last(results).message).toContain('(test "shopping-list-add-item")')
  }, 60_000)

  it("kapija 4: dugme bez role=\"button\" dobija savet", async () => {
    const results = await runGates(input(drafts.BAD_ROLE))
    expect(last(results)).toMatchObject({ gate: "labels", ok: false })
    expect(last(results).message).toContain('postoji tekst "Dodaj", ali nijedan element sa role="button" nema taj naziv')
  }, 60_000)

  it("kapija 4: labela polja iz submit koraka (Enter) mora da postoji", async () => {
    const submitTest = ScenarioSchema.parse({
      id: "shopping-list-submit",
      unitId: "shopping-list",
      obligation: "add-item",
      steps: [{ goto: "/kupovina" }, { submit: { label: "Namirnica", value: "Hleb" } }],
    })
    const ok = await runGates({ ...input(drafts.GOOD), tests: [submitTest] })
    expect(last(ok)).toMatchObject({ gate: "labels", ok: true })
    const bad = await runGates({ ...input(drafts.BAD_LABEL), tests: [submitTest] })
    expect(last(bad)).toMatchObject({ gate: "labels", ok: false })
    expect(last(bad).message).toContain('nema elementa sa accessibilityLabel "Namirnica"')
    expect(last(bad).message).toContain('(test "shopping-list-submit")')
  }, 60_000)

  it("kapija 4: naziv linka iz izraza (ternarni operator, map) se prepoznaje", async () => {
    const linkTest = ScenarioSchema.parse({
      id: "filters",
      unitId: "shopping-list",
      obligation: "add-item",
      steps: [{ goto: "/kupovina" }, { tap: { role: "link", name: "Dodaj" } }],
    })
    const code = drafts.GOOD.replace(
      '<Pressable role="button" onPress={add}>\n        <Text>Dodaj</Text>',
      '<Pressable role="link" onPress={add}>\n        <Text style={{ color: "red" }}>{name ? "Dodaj" : "Unesi"}</Text>',
    )
    expect(code).toContain('role="link"')
    const results = await runGates({ ...input(code), tests: [linkTest] })
    expect(last(results)).toMatchObject({ gate: "labels", ok: true })
  }, 60_000)

  it("kapija 4: promenjen tekst", async () => {
    const results = await runGates(input(drafts.BAD_TEXT))
    expect(last(results)).toMatchObject({ gate: "labels", ok: false })
    expect(last(results).message).toContain('tekst "Lista za kupovinu je prazna" ne postoji u kodu')
  }, 60_000)
})
