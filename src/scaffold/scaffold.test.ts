import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanSchema, type Plan } from "../contracts"
import { scaffold } from "./index"
import { PLACEHOLDER, TEMPLATE_DIR } from "./scaffold"
import { routeFile } from "./routes"

// Ručni plan za Recepte (vlasnik: D), isti koji se koristi u kapiji G1.
const RECEPTI_PLAN = fileURLToPath(new URL("../../examples/recepti/wemora/plan.manual.json", import.meta.url))
const loadPlan = (): Plan => PlanSchema.parse(JSON.parse(readFileSync(RECEPTI_PLAN, "utf8")))

function filesUnder(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else out.push(relative(dir, p).split("\\").join("/"))
    }
  }
  walk(dir)
  return out.sort()
}

let outDir: string
beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), "wemora-scaffold-"))
})
afterEach(() => {
  rmSync(outDir, { recursive: true, force: true })
})

describe("scaffold nad planom za Recepte", () => {
  it("pravi tačan raspored fajlova u app/src/", async () => {
    await scaffold(loadPlan(), outDir)
    expect(filesUnder(join(outDir, "app/src"))).toEqual([
      "app/_layout.tsx",
      "app/index.tsx",
      "app/kategorije.tsx",
      "app/kupovina.tsx",
      "app/omiljeni.tsx",
      "app/recepti/[id].tsx",
      "screens/.gitkeep",
      "screens/categories/index.tsx",
      "screens/favorites/index.tsx",
      "screens/recipe-detail/index.tsx",
      "screens/recipe-list/index.tsx",
      "screens/shopping-list/index.tsx",
      "shared/config.ts",
      "shared/data/.gitkeep",
      "shared/layout/.gitkeep",
      "shared/theme/.gitkeep", // plan.manual.json has the theme unit since D-027
    ])
  })

  it("ruta prikazuje ekran svoje jedinice", async () => {
    await scaffold(loadPlan(), outDir)
    const read = (f: string) => readFileSync(join(outDir, "app/src/app", f), "utf8")
    expect(read("index.tsx")).toContain('from "@/screens/recipe-list"')
    expect(read("recepti/[id].tsx")).toContain('from "@/screens/recipe-detail"')
    expect(read("kupovina.tsx")).toContain('from "@/screens/shopping-list"')
  })

  it("kopira šablon bez node_modules, dist i .expo", async () => {
    await scaffold(loadPlan(), outDir)
    const app = join(outDir, "app")
    expect(existsSync(join(app, "package.json"))).toBe(true)
    expect(existsSync(join(app, "app.json"))).toBe(true)
    // app/.env sa adresom mock-api-ja, za ručni `expo start` (A → C)
    expect(readFileSync(join(app, ".env"), "utf8")).toContain("EXPO_PUBLIC_API_URL=http://localhost:3000")
    expect(existsSync(join(app, "dist"))).toBe(false)
    expect(existsSync(join(app, ".expo"))).toBe(false)
    // node_modules je link na šablon (ako je šablon instaliran), nikad kopija
    if (existsSync(join(TEMPLATE_DIR, "node_modules"))) {
      expect(lstatSync(join(app, "node_modules")).isSymbolicLink()).toBe(true)
    }
  })
})

describe("prazan ekran", () => {
  it("nema nijedan tekst ni labelu koju bi test mogao da nađe", () => {
    expect(PLACEHOLDER).not.toMatch(/<Text|accessibilityLabel|aria-label|placeholder=|title=|role=/)
    // JSX bez dece: nema teksta između tagova
    expect(PLACEHOLDER).not.toMatch(/>[^<\s][^<]*</)
  })

  it("svi ekrani posle scaffolda su baš prazan ekran", async () => {
    const plan = loadPlan()
    await scaffold(plan, outDir)
    for (const unit of plan.units.filter((u) => u.kind === "screen")) {
      expect(readFileSync(join(outDir, "app/src/screens", unit.id, "index.tsx"), "utf8")).toBe(PLACEHOLDER)
    }
  })
})

describe("greške u planu", () => {
  const withScreen = (route: string | undefined, routeMap: Record<string, string>, id = "ekran"): Plan => {
    const plan = loadPlan()
    const screen = { ...plan.units.find((u) => u.kind === "screen")!, id, route }
    return { ...plan, units: [screen], routeMap }
  }

  it("ekran bez rute", async () => {
    await expect(scaffold(withScreen(undefined, {}), outDir)).rejects.toThrow('Ekran "ekran" nema "route"')
  })

  it("ruta koje nema u routeMap", async () => {
    await expect(scaffold(withScreen("/x", {}), outDir)).rejects.toThrow('rutu "/x" koje nema u "routeMap"')
  })

  it("dva ekrana na istoj Expo adresi", async () => {
    const a = withScreen("/a", { "/a": "/isto", "/b": "/isto" }, "a")
    const b = { ...a.units[0]!, id: "b", route: "/b" }
    await expect(scaffold({ ...a, units: [...a.units, b] }, outDir)).rejects.toThrow('vode na istu Expo adresu "/isto"')
  })

  it("Expo adresa u web obliku (:id)", async () => {
    await expect(scaffold(withScreen("/r/:id", { "/r/:id": "/r/:id" }), outDir)).rejects.toThrow('neispravan deo ":id"')
  })

  it("ID koji nije bezbedan za ime foldera", async () => {
    await expect(scaffold(withScreen("/a", { "/a": "/a" }, "../van"), outDir)).rejects.toThrow("ne može da bude ime foldera")
  })

  it("plan koji ne prolazi šemu", async () => {
    await expect(scaffold({ units: [] } as unknown as Plan, outDir)).rejects.toThrow()
  })

  it("ne prepisuje postojeću aplikaciju", async () => {
    mkdirSync(join(outDir, "app"))
    await expect(scaffold(loadPlan(), outDir)).rejects.toThrow("već postoji")
  })
})

describe("routeFile", () => {
  it("pretvara Expo adresu u fajl rute", () => {
    expect(routeFile("/", [])).toBe("index.tsx")
    expect(routeFile("/kategorije", [])).toBe("kategorije.tsx")
    expect(routeFile("/recepti/[id]", [])).toBe("recepti/[id].tsx")
    expect(routeFile("/recepti", ["/recepti", "/recepti/[id]"])).toBe("recepti/index.tsx")
  })
})
