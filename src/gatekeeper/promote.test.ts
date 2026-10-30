import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { promote, rollback } from "./index"

let run: string
let src: string

function put(base: string, files: Record<string, string>) {
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(dirname(join(base, p)), { recursive: true })
    writeFileSync(join(base, p), content)
  }
}

/** Ceo sadržaj foldera: fajlovi sa sadržajem i prazni folderi. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (rel: string) => {
    const entries = readdirSync(join(dir, rel), { withFileTypes: true })
    if (entries.length === 0) out[`${rel}/`] = "(prazan folder)"
    for (const e of entries) {
      const p = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(p)
      else out[p] = readFileSync(join(dir, p), "utf8")
    }
  }
  walk("")
  return out
}

function draft(unitId: string, files: Record<string, string>, builder = "builder-1"): string {
  const dir = join(run, "staging", builder, unitId)
  mkdirSync(dir, { recursive: true })
  put(dir, files)
  return dir
}

beforeEach(() => {
  run = mkdtempSync(join(tmpdir(), "wemora-promote-"))
  src = join(run, "app/src")
  put(src, {
    "app/kupovina.tsx": 'export { default } from "@/screens/shopping-list"\n',
    "screens/shopping-list/index.tsx": "// prazan ekran\n",
    "screens/shopping-list/old-helper.ts": "export const x = 1\n",
    "screens/favorites/index.tsx": "// tuđi ekran\n",
    "shared/data/store.ts": "export const store = {}\n",
  })
})
afterEach(() => {
  rmSync(run, { recursive: true, force: true })
})

describe("promote", () => {
  it("ubacuje nacrt u app/src/ i briše stare fajlove iz foldera jedinice", async () => {
    await promote("shopping-list", draft("shopping-list", {
      "screens/shopping-list/index.tsx": "// novi ekran\n",
      "screens/shopping-list/parts/Row.tsx": "// red\n",
    }))
    const after = snapshot(src)
    expect(after["screens/shopping-list/index.tsx"]).toBe("// novi ekran\n")
    expect(after["screens/shopping-list/parts/Row.tsx"]).toBe("// red\n")
    expect(after["screens/shopping-list/old-helper.ts"]).toBeUndefined()
    // tuđi fajlovi netaknuti
    expect(after["screens/favorites/index.tsx"]).toBe("// tuđi ekran\n")
    expect(after["shared/data/store.ts"]).toBe("export const store = {}\n")
  })

  it("odbija nacrt van output/<run>/staging/<builder>/<unit>/", async () => {
    const elsewhere = join(run, "negde", "shopping-list")
    put(elsewhere, { "screens/shopping-list/index.tsx": "x" })
    await expect(promote("shopping-list", elsewhere)).rejects.toThrow("nije u output/<run>/staging/")
  })

  it("odbija prazan nacrt", async () => {
    await expect(promote("shopping-list", draft("shopping-list", {}))).rejects.toThrow("je prazan")
  })
})

describe("rollback", () => {
  it("posle promote vraća TAČNO prethodne fajlove i foldere", async () => {
    const before = snapshot(src)
    await promote("shopping-list", draft("shopping-list", {
      "screens/shopping-list/index.tsx": "// novi ekran\n",
      "screens/shopping-list/parts/deep/Row.tsx": "// novi fajl u novom folderu\n",
      "app/kupovina.tsx": "// izmenjena ruta\n",
    }))
    expect(snapshot(src)).not.toEqual(before)
    await rollback("shopping-list")
    expect(snapshot(src)).toEqual(before)
    expect(existsSync(join(src, "screens/shopping-list/parts"))).toBe(false)
  })

  it("vraća stanje pre poslednje promocije iste jedinice", async () => {
    await promote("shopping-list", draft("shopping-list", { "screens/shopping-list/index.tsx": "// v1\n" }, "b1"))
    const afterV1 = snapshot(src)
    await promote("shopping-list", draft("shopping-list", { "screens/shopping-list/index.tsx": "// v2\n" }, "b2"))
    await rollback("shopping-list")
    expect(snapshot(src)).toEqual(afterV1)
  })

  it("rollback jedne jedinice ne dira drugu", async () => {
    await promote("shopping-list", draft("shopping-list", { "screens/shopping-list/index.tsx": "// lista\n" }))
    await promote("favorites", draft("favorites", { "screens/favorites/index.tsx": "// omiljeni\n" }))
    await rollback("shopping-list")
    expect(readFileSync(join(src, "screens/favorites/index.tsx"), "utf8")).toBe("// omiljeni\n")
    expect(readFileSync(join(src, "screens/shopping-list/index.tsx"), "utf8")).toBe("// prazan ekran\n")
  })

  it("bez promocije daje jasnu grešku", async () => {
    await expect(rollback("nepoznata")).rejects.toThrow('Nema promocije jedinice "nepoznata"')
  })

  it("drugi rollback zaredom nema šta da vrati", async () => {
    await promote("shopping-list", draft("shopping-list", { "screens/shopping-list/index.tsx": "// x\n" }))
    await rollback("shopping-list")
    await expect(rollback("shopping-list")).rejects.toThrow("Nema promocije")
  })
})
