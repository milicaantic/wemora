import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PlanSchema } from "../contracts"
import { scaffold } from "../scaffold/index"
import { serveApp } from "./index"

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
// Pravi export traži instaliran šablon (npm install u templates/expo).
const hasTemplateModules = existsSync(root("templates/expo/node_modules/expo/bin/cli"))

describe.skipIf(!hasTemplateModules)("serveApp (pravi Expo web export)", () => {
  let tmp: string
  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), "wemora-serve-"))
    const plan = PlanSchema.parse(JSON.parse(readFileSync(root("examples/recepti/wemora/plan.manual.json"), "utf8")))
    await scaffold(plan, tmp)
  })
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it("vraća URL na kome se otvara aplikacija, a posle close() ne ostaje ništa", async () => {
    const app = await serveApp(join(tmp, "app"))

    const home = await fetch(`${app.url}/`)
    expect(home.status).toBe(200)
    expect(await home.text()).toContain("<html")
    // ruta iz plana radi preko SPA rezerve
    expect((await fetch(`${app.url}/recepti/1`)).status).toBe(200)
    // export nije pisao u app/
    expect(existsSync(join(tmp, "app/dist"))).toBe(false)

    await app.close()
    await expect(fetch(`${app.url}/`)).rejects.toThrow()
  }, 240_000)

  it("javlja jasnu grešku za aplikaciju bez paketa", async () => {
    await expect(serveApp(join(tmp, "nema-aplikacije"))).rejects.toThrow("Nema Expo CLI")
  })
})
