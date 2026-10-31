import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { PlanSchema, type Plan, type Scaffold } from "../contracts"
import { routeFile } from "./routes"

export const TEMPLATE_DIR = fileURLToPath(new URL("../../templates/expo", import.meta.url))

// Ono što se iz šablona ne kopira.
const SKIP = /[\\/](node_modules|dist|\.expo)$/

// ID jedinice postaje ime foldera, pa mora da bude bezbedan.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

// Prazan ekran: namerno bez ijednog teksta i labele, da svaki test nad njim padne.
export const PLACEHOLDER = `import { View } from "react-native"

export default function Placeholder() {
  return <View style={{ flex: 1 }} />
}
`

export function routeFileContent(unitId: string): string {
  return `export { default } from "@/screens/${unitId}"\n`
}

type ScreenRoute = { unitId: string; expoPath: string }

/** Proverava plan i vraća rute ekrana. Baca grešku sa jasnom porukom ako nešto ne valja. */
function screenRoutes(plan: Plan): ScreenRoute[] {
  for (const unit of plan.units) {
    if (!SAFE_ID.test(unit.id)) {
      throw new Error(`ID jedinice "${unit.id}" ne može da bude ime foldera. Dozvoljeno: slova, brojevi, "-" i "_".`)
    }
  }
  const routes: ScreenRoute[] = []
  for (const unit of plan.units.filter((u) => u.kind === "screen")) {
    if (!unit.route) throw new Error(`Ekran "${unit.id}" nema "route" u planu.`)
    const expoPath = plan.routeMap[unit.route]
    if (!expoPath) {
      throw new Error(`Ekran "${unit.id}" ima rutu "${unit.route}" koje nema u "routeMap".`)
    }
    const same = routes.find((r) => r.expoPath === expoPath)
    if (same) throw new Error(`Ekrani "${same.unitId}" i "${unit.id}" vode na istu Expo adresu "${expoPath}".`)
    routes.push({ unitId: unit.id, expoPath })
  }
  return routes
}

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

/**
 * Iz plana pravi Expo aplikaciju sa praznim ekranima u `outDir/app/`:
 * kopija šablona, ruta po ekranu (`src/app/…`), prazan ekran u `src/screens/<id>/`
 * i prazan `src/shared/<id>/` za svaku zajedničku jedinicu.
 */
export const scaffold: Scaffold = async (input, outDir) => {
  const plan = PlanSchema.parse(input)
  const routes = screenRoutes(plan)

  const appDir = join(outDir, "app")
  if (existsSync(appDir)) throw new Error(`"${appDir}" već postoji. Scaffold ne prepisuje postojeću aplikaciju.`)

  cpSync(TEMPLATE_DIR, appDir, { recursive: true, filter: (src) => !SKIP.test(src) })
  // Paketi se ne kopiraju (stotine MB): link na šablon, a i keš ostaje topao (D-006).
  const modules = join(TEMPLATE_DIR, "node_modules")
  if (existsSync(modules)) symlinkSync(modules, join(appDir, "node_modules"), "junction")

  // .env iz .env.example: Expo ga čita i za ručni `expo start` (adresa mock-api-ja); export je i bez njega
  // dobija iz serveApp/exportEnv. Root .gitignore ignoriše .env, pa ne ide u git.
  const example = join(appDir, ".env.example")
  if (existsSync(example)) writeFileSync(join(appDir, ".env"), readFileSync(example))

  // Početna ruta šablona se uklanja; rute dolaze samo iz plana.
  rmSync(join(appDir, "src/app/index.tsx"), { force: true })

  const allPaths = routes.map((r) => r.expoPath)
  for (const { unitId, expoPath } of routes) {
    write(join(appDir, "src/app", routeFile(expoPath, allPaths)), routeFileContent(unitId))
    write(join(appDir, "src/screens", unitId, "index.tsx"), PLACEHOLDER)
  }
  for (const unit of plan.units.filter((u) => u.kind === "shared")) {
    write(join(appDir, "src/shared", unit.id, ".gitkeep"), "")
  }
}
