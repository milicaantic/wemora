import { PlanSchema, type Obligation, type ParsedApp, type Plan, type Unit } from "../contracts"
import { expoRouteFor } from "./expoRoute"
import { normalizeRequestedPath } from "./fileAccess"
import { knownSourceFiles, sourceTokens } from "./styles"

/** ID of the shared unit that carries fonts, sizes and colors from the web app (D-027). */
export const THEME_UNIT = "theme"

/** What the architect model returns: a plan without routeMap, which the code computes. */
export const ArchitectOutputSchema = PlanSchema.omit({ routeMap: true })
export type ArchitectOutput = Omit<Plan, "routeMap"> & { routeMap?: Plan["routeMap"] }

const ownPrefix = (unit: Pick<Unit, "kind" | "id">) => `src/${unit.kind === "screen" ? "screens" : "shared"}/${unit.id}/`

/**
 * Waves from dependsOn: shared → 0, a screen → 1 + the highest wave among the screens it depends on.
 * Units in a dependency cycle, or depending on one, are left out (they keep the model's wave).
 */
function computeWaves(units: Unit[]): Map<string, number> {
  const byId = new Map(units.map((u) => [u.id, u]))
  const waves = new Map<string, number>()
  const visiting = new Set<string>()
  const wave = (unit: Unit): number | null => {
    const known = waves.get(unit.id)
    if (known !== undefined) return known
    if (unit.kind === "shared") return waves.set(unit.id, 0).get(unit.id)!
    if (visiting.has(unit.id)) return null
    visiting.add(unit.id)
    let result = 1
    for (const depId of unit.dependsOn) {
      const dep = byId.get(depId)
      if (!dep || dep.id === unit.id || dep.kind === "shared") continue
      const depWave = wave(dep)
      if (depWave === null) return null
      result = Math.max(result, depWave + 1)
    }
    visiting.delete(unit.id)
    waves.set(unit.id, result)
    return result
  }
  for (const unit of units) wave(unit)
  return waves
}

/**
 * Overwrites what the code knows better than the model, before validatePlan runs:
 * paths ("\" → "/"), unknown sources dropped, size from the files, waves from dependsOn,
 * default writes, routeMap for every route, and a stable order. Running it twice changes nothing.
 * Problems it cannot fix (a route without a screen, a file in two units, a cycle) stay for validatePlan.
 */
export function normalizePlan(input: ArchitectOutput, parsed: ParsedApp): Plan {
  const known = knownSourceFiles(parsed)
  const tokenCache = new Map<string, number>()
  const tokensOf = (file: string) => {
    if (!tokenCache.has(file)) tokenCache.set(file, sourceTokens(parsed, file))
    return tokenCache.get(file)!
  }
  // With a shared "theme" unit (D-027), every other unit uses its fonts and colors, so it depends on it.
  const hasTheme = input.units.some((u) => u.id === THEME_UNIT && u.kind === "shared")

  const units: Unit[] = input.units.map((unit) => {
    const sources = [...new Set(unit.sources.map(normalizeRequestedPath).filter((f): f is string => f !== null && known.has(f)))].sort()
    const dependsOn = hasTheme && unit.id !== THEME_UNIT ? [...unit.dependsOn, THEME_UNIT] : unit.dependsOn
    return {
      ...unit,
      sources,
      writes: unit.writes.length > 0 ? [...new Set(unit.writes)] : [ownPrefix(unit)],
      dependsOn: [...new Set(dependsOn)].sort(),
      obligations: [...unit.obligations].sort((a: Obligation, b: Obligation) => a.id.localeCompare(b.id)),
      size: sources.reduce((sum, f) => sum + tokensOf(f), 0),
    }
  })

  const waves = computeWaves(units)
  for (const unit of units) unit.wave = waves.get(unit.id) ?? unit.wave

  const paths = parsed.routes.map((r) => r.path)
  const routeMap: Record<string, string> = {}
  for (const path of [...paths].sort()) routeMap[path] = input.routeMap?.[path] ?? expoRouteFor(path, paths)

  return {
    units: units.sort((a, b) => a.wave - b.wave || a.id.localeCompare(b.id)),
    flows: [...input.flows].sort((a, b) => a.id.localeCompare(b.id)),
    routeMap,
  }
}
