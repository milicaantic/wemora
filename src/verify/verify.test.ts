import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import type { ServeApp } from "../contracts"
import { createRunScenarios, serveStatic } from "../scenarios"
import { createVerifyDetailed, formatVerifyReport } from "./verify"

// A hand-made finished run (src/verify/mocks/run/): "lista" passed in the run (partial), "detalj" failed and
// "prazan" has no tests. Instead of an Expo export of app/, the fake serveApp serves the static page in web/.
const fixture = fileURLToPath(new URL("./mocks/run", import.meta.url))
const servedFrom: string[] = []
const serveWeb: ServeApp = async (appDir) => {
  servedFrom.push(appDir)
  return serveStatic(path.join(path.dirname(appDir), "web"))
}
// Short limits keep the deliberately failing test fast.
const runScenarios = createRunScenarios({ stepTimeoutMs: 1_500, navigationTimeoutMs: 5_000, scrollGraceMs: 300, maxScrolls: 5, networkQuietMs: 300 })
const verifyDetailed = createVerifyDetailed({ serveApp: serveWeb, runScenarios })

const copies: string[] = []
function copyOfFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "wemora-verify-"))
  cpSync(fixture, dir, { recursive: true })
  copies.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true })
})

describe("verify", { timeout: 60_000 }, () => {
  it("passes when every test of a screen that passed in the run still passes; failed screens do not count", async () => {
    const details = await verifyDetailed(fixture)
    expect(details.ok).toBe(true)
    expect(servedFrom.at(-1)).toBe(path.join(fixture, "app"))

    const byUnit = Object.fromEntries(details.units.map((u) => [u.unitId, u]))
    expect(Object.keys(byUnit)).toEqual(["lista", "detalj", "prazan"])
    expect(byUnit.lista).toMatchObject({ status: "partial", counted: true })
    expect(byUnit.lista.results.map((r) => r.ok)).toEqual([true, true])
    // Its test fails now as it did in the run, but a failed screen is only reported.
    expect(byUnit.detalj).toMatchObject({ status: "failed", counted: false })
    expect(byUnit.detalj.results.map((r) => r.ok)).toEqual([false])
    expect(byUnit.prazan).toMatchObject({ status: null, counted: false, tests: [] })
  })

  it("fails on a broken screen, and only on it", async () => {
    const run = copyOfFixture()
    // Break the screen like a sabotage would: the search field is gone.
    const page = path.join(run, "web", "index.html")
    writeFileSync(page, readFileSync(page, "utf8").replace('<label for="pretraga">Pretraga</label>', ""))

    const details = await verifyDetailed(run)
    expect(details.ok).toBe(false)
    const lista = details.units.find((u) => u.unitId === "lista")!
    expect(lista.results.map((r) => `${r.scenarioId}:${r.ok}`)).toEqual(["lista-shows-items:true", "lista-search:false"])
  })

  it("prints the same matrix every time, without durations", async () => {
    const first = formatVerifyReport(await verifyDetailed(fixture))
    const second = formatVerifyReport(await verifyDetailed(fixture))
    expect(second).toBe(first)
    expect(first).toContain("lista  [partial]")
    expect(first).toContain("  pass  lista-search")
    expect(first).toContain("detalj  [failed]  (not counted: its tests did not pass in the run)")
    expect(first).toContain('  FAIL  detalj-shows-detail at step 2: expectVisible "Detalj recepta": not found on screen')
    expect(first).toContain("prazan  [no result]  (no tests)")
    expect(first).toMatch(/OK: 2\/2 tests pass on 1 screen\(s\)/)
  })

  it("tells what is wrong when the folder is not a run", async () => {
    const empty = mkdtempSync(path.join(tmpdir(), "wemora-verify-empty-"))
    copies.push(empty)
    await expect(verifyDetailed(empty)).rejects.toThrow(/plan\.json not found/)
  })
})
