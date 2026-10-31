import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { SABOTAGE_MARK, sabotageDetailed } from "./sabotage"

// The hand-made run from verify tests: "lista" is partial (counted by verify), "detalj" failed, "prazan" has no
// result, "data" is shared. Each test gets a copy, with the screen code written by the test.
const fixture = fileURLToPath(new URL("./mocks/run", import.meta.url))
const copies: string[] = []

function runWithScreen(code: string): { run: string; screen: string } {
  const run = mkdtempSync(path.join(tmpdir(), "wemora-sabotage-"))
  copies.push(run)
  cpSync(fixture, run, { recursive: true })
  const dir = path.join(run, "app", "src", "screens", "lista")
  mkdirSync(dir, { recursive: true })
  const screen = path.join(dir, "index.tsx")
  writeFileSync(screen, code)
  return { run, screen }
}

const listaScreen = `import { Text, TextInput, View } from "react-native"

export default function Lista() {
  const Pretraga = "the search state"
  return (
    <View>
      <TextInput accessibilityLabel="Pretraga" />
      <Text>Jabuka</Text>
      <Text>Kruška</Text>
    </View>
  )
}
`

afterAll(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true })
})

describe("sabotage", () => {
  it("replaces the field label the tests use, only where it is a string, and says what it changed", async () => {
    const { run, screen } = runWithScreen(listaScreen)
    const change = await sabotageDetailed(run, "lista")
    expect(change).toEqual({ unitId: "lista", file: path.join("app", "src", "screens", "lista", "index.tsx"), target: "Pretraga", kind: "label" })

    const code = readFileSync(screen, "utf8")
    expect(code).toContain(`accessibilityLabel="${SABOTAGE_MARK}"`)
    // The identifier with the same name and the texts the label does not touch stay as they were.
    expect(code).toContain('const Pretraga = "the search state"')
    expect(code).toContain("<Text>Jabuka</Text>")
  })

  it("makes the same change on two copies of the same run", async () => {
    const a = runWithScreen(listaScreen)
    const b = runWithScreen(listaScreen)
    await sabotageDetailed(a.run, "lista")
    await sabotageDetailed(b.run, "lista")
    expect(readFileSync(a.screen, "utf8")).toBe(readFileSync(b.screen, "utf8"))
  })

  it("falls back to a visible text when the label is not in the code", async () => {
    const { run, screen } = runWithScreen(listaScreen.replace('<TextInput accessibilityLabel="Pretraga" />', "<TextInput />"))
    expect(await sabotageDetailed(run, "lista")).toMatchObject({ target: "Jabuka", kind: "text" })
    expect(readFileSync(screen, "utf8")).toContain(`<Text>${SABOTAGE_MARK}</Text>`)
  })

  it("refuses screens verify would not count, shared and unknown units, and a second sabotage", async () => {
    const { run } = runWithScreen(listaScreen)
    await expect(sabotageDetailed(run, "detalj")).rejects.toThrow(/status failed/)
    await expect(sabotageDetailed(run, "prazan")).rejects.toThrow(/status none/)
    await expect(sabotageDetailed(run, "data")).rejects.toThrow(/is shared/)
    await expect(sabotageDetailed(run, "nema")).rejects.toThrow(/not in the plan; screens: lista, detalj, prazan/)
    await sabotageDetailed(run, "lista")
    await expect(sabotageDetailed(run, "lista")).rejects.toThrow(/already sabotaged/)
  })

  it("says so when none of the tested names is written in the screen code", async () => {
    const { run } = runWithScreen("export default function Lista() { return null }\n")
    await expect(sabotageDetailed(run, "lista")).rejects.toThrow(/nothing to break/)
  })
})
