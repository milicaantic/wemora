import { PlanSchema, type Plan, type Unit, type ValidatePlan } from "../contracts"

// Checks a plan against the parser's view of the app (docs/architecture.md §8).
// Messages are in English and name the exact unit, file or route, because the architect
// model gets them back and has to fix the plan from them alone.

const ID = /^[a-z0-9][a-z0-9-]*$/

const ownPrefix = (unit: Unit) => `src/${unit.kind === "screen" ? "screens" : "shared"}/${unit.id}/`
const list = (items: string[]) => items.map((x) => `"${x}"`).join(", ")
const overlaps = (a: string, b: string) => a.startsWith(b) || b.startsWith(a)

/** Finds one dependency cycle, as a list of unit ids that starts and ends with the same id. */
function findCycle(units: Unit[]): string[] | null {
  const byId = new Map(units.map((u) => [u.id, u]))
  const state = new Map<string, "visiting" | "done">()
  const stack: string[] = []
  const visit = (id: string): string[] | null => {
    if (state.get(id) === "done") return null
    if (state.get(id) === "visiting") return [...stack.slice(stack.indexOf(id)), id]
    state.set(id, "visiting")
    stack.push(id)
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (!byId.has(dep) || dep === id) continue // reported by other rules
      const cycle = visit(dep)
      if (cycle) return cycle
    }
    stack.pop()
    state.set(id, "done")
    return null
  }
  for (const unit of units) {
    const cycle = visit(unit.id)
    if (cycle) return cycle
  }
  return null
}

export const validatePlan: ValidatePlan = (input, parsed) => {
  // 1. Shape. Nothing else can be checked on a plan that does not match the contract.
  const shape = PlanSchema.safeParse(input)
  if (!shape.success) {
    return shape.error.issues.map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join(".") : "plan"
      return `plan does not match the schema at ${where}: ${issue.message}`
    })
  }
  const plan: Plan = shape.data
  const errors: string[] = []
  const units = [...plan.units].sort((a, b) => a.id.localeCompare(b.id))
  const byId = new Map(units.map((u) => [u.id, u]))
  const screens = units.filter((u) => u.kind === "screen")

  // 2. Unit ids: unique, usable as folder names.
  const seenIds = new Set<string>()
  for (const unit of plan.units) {
    if (seenIds.has(unit.id)) errors.push(`unit id "${unit.id}" is used more than once`)
    seenIds.add(unit.id)
    if (!ID.test(unit.id)) errors.push(`unit id "${unit.id}" must be kebab-case (lowercase letters, digits and "-"), because it becomes a folder name`)
  }

  // 3. Kind and route go together.
  for (const unit of units) {
    if (unit.kind === "screen" && unit.route === undefined) errors.push(`screen unit "${unit.id}" has no route`)
    if (unit.kind === "shared" && unit.route !== undefined) errors.push(`shared unit "${unit.id}" must not have a route (it has "${unit.route}")`)
  }

  // 4. Every parsed route is covered by exactly one screen, and screens only use parsed routes.
  const parsedRoutes = new Set(parsed.routes.map((r) => r.path))
  for (const route of parsed.routes) {
    const covering = screens.filter((u) => u.route === route.path)
    if (covering.length === 0) errors.push(`route "${route.path}" is not covered by any screen unit; add a screen unit with route "${route.path}"`)
    if (covering.length > 1) errors.push(`route "${route.path}" is covered by ${covering.length} screen units (${list(covering.map((u) => u.id))}); exactly one is allowed`)
  }
  for (const unit of screens) {
    if (unit.route !== undefined && !parsedRoutes.has(unit.route)) {
      errors.push(`screen unit "${unit.id}" has route "${unit.route}", which the app does not have; known routes: ${list([...parsedRoutes])}`)
    }
  }

  // 5. Sources exist and belong to at most one unit.
  const knownFiles = new Set([...parsed.sharedFiles, ...parsed.routes.flatMap((r) => r.files)])
  const ownerOf = new Map<string, string[]>()
  for (const unit of units) {
    for (const file of new Set(unit.sources)) {
      if (!knownFiles.has(file)) errors.push(`unit "${unit.id}" lists source "${file}", which is not a file of the app (paths are relative to the web project, with "/")`)
      ownerOf.set(file, [...(ownerOf.get(file) ?? []), unit.id])
    }
    if (new Set(unit.sources).size !== unit.sources.length) errors.push(`unit "${unit.id}" lists the same source file more than once`)
  }
  for (const [file, owners] of [...ownerOf].sort(([a], [b]) => a.localeCompare(b))) {
    if (owners.length > 1) errors.push(`file "${file}" is in units ${list(owners)}; a file may belong to at most one unit`)
  }

  // 6. The screen component file goes with its screen (unless the parser found it in shared code).
  for (const route of parsed.routes) {
    if (parsed.sharedFiles.includes(route.file)) continue
    const unit = screens.find((u) => u.route === route.path)
    if (unit && !unit.sources.includes(route.file)) {
      errors.push(`screen unit "${unit.id}" (route "${route.path}") must list its component file "${route.file}" in sources`)
    }
  }

  // 7. Dependencies point at other existing units and have no cycles.
  for (const unit of units) {
    for (const dep of unit.dependsOn) {
      if (dep === unit.id) errors.push(`unit "${unit.id}" depends on itself`)
      else if (!byId.has(dep)) errors.push(`unit "${unit.id}" depends on unknown unit "${dep}"`)
    }
    if (new Set(unit.dependsOn).size !== unit.dependsOn.length) errors.push(`unit "${unit.id}" lists the same dependency more than once`)
  }
  const cycle = findCycle(units)
  if (cycle) errors.push(`dependency cycle: ${cycle.join(" -> ")}; units must form a tree of waves`)

  // 8. Waves: shared units are wave 0 and depend only on shared units; a screen comes after its dependencies.
  for (const unit of units) {
    const deps = unit.dependsOn.map((d) => byId.get(d)).filter((d): d is Unit => d !== undefined && d.id !== unit.id)
    if (unit.kind === "shared") {
      if (unit.wave !== 0) errors.push(`shared unit "${unit.id}" must be in wave 0 (it is in wave ${unit.wave})`)
      for (const dep of deps) {
        if (dep.kind === "screen") errors.push(`shared unit "${unit.id}" must not depend on screen unit "${dep.id}"`)
      }
    } else {
      if (unit.wave < 1) errors.push(`screen unit "${unit.id}" must be in wave 1 or later (it is in wave ${unit.wave})`)
      for (const dep of deps) {
        if (unit.wave <= dep.wave) {
          errors.push(`screen unit "${unit.id}" (wave ${unit.wave}) must be in a later wave than its dependency "${dep.id}" (wave ${dep.wave})`)
        }
      }
    }
  }

  // 9. writes: only inside the unit's own folder in app/, and never overlapping another unit.
  for (const unit of units) {
    if (unit.writes.length === 0) errors.push(`unit "${unit.id}" has no writes; use ["${ownPrefix(unit)}"]`)
    for (const path of unit.writes) {
      if (!path.startsWith(ownPrefix(unit))) {
        errors.push(`unit "${unit.id}" writes "${path}", outside its folder "${ownPrefix(unit)}" (paths are relative to app/)`)
      }
    }
  }
  for (const [i, a] of units.entries()) {
    for (const b of units.slice(i + 1)) {
      const clash = a.writes.find((pa) => b.writes.some((pb) => overlaps(pa, pb)))
      if (clash) errors.push(`units "${a.id}" and "${b.id}" both write under "${clash}"`)
    }
  }

  // 10. Obligations: every screen has some; shared units have none (they have no UI tests of their own).
  for (const unit of units) {
    if (unit.kind === "screen" && unit.obligations.length === 0) {
      errors.push(`screen unit "${unit.id}" has no obligations; list the behaviors its tests must cover`)
    }
    if (unit.kind === "shared" && unit.obligations.length > 0) {
      errors.push(`shared unit "${unit.id}" must not have obligations; shared units are proven through the screens that use them`)
    }
    const seen = new Set<string>()
    for (const obligation of unit.obligations) {
      if (seen.has(obligation.id)) errors.push(`unit "${unit.id}" has obligation id "${obligation.id}" more than once`)
      seen.add(obligation.id)
      if (!ID.test(obligation.id)) errors.push(`obligation id "${obligation.id}" in unit "${unit.id}" must be kebab-case`)
    }
  }

  // 11. Intentional differences: only on screens; movedTo points at another screen.
  for (const unit of units) {
    if (unit.kind === "shared" && unit.intentionalDifferences.length > 0) {
      errors.push(`shared unit "${unit.id}" must not have intentional differences; put them on the screen that shows the element`)
    }
    for (const difference of unit.intentionalDifferences) {
      if (difference.kind !== "movedTo") continue
      const target = byId.get(difference.toUnit)
      if (difference.toUnit === unit.id) errors.push(`unit "${unit.id}" has a movedTo difference that points at itself`)
      else if (!target) errors.push(`unit "${unit.id}" moves "${difference.what}" to unknown unit "${difference.toUnit}"`)
      else if (target.kind !== "screen") errors.push(`unit "${unit.id}" moves "${difference.what}" to shared unit "${difference.toUnit}"; move it to a screen`)
    }
  }

  // 12. routeMap: one Expo path for every web route, unique, with ":param" written as "[param]".
  const expoPaths = new Map<string, string>()
  for (const route of [...parsedRoutes].sort()) {
    const expo = plan.routeMap[route]
    if (expo === undefined) {
      errors.push(`routeMap has no entry for route "${route}"`)
      continue
    }
    if (!expo.startsWith("/")) errors.push(`routeMap["${route}"] is "${expo}"; an Expo Router path starts with "/"`)
    if (expo.includes(":") || expo.includes("*")) errors.push(`routeMap["${route}"] is "${expo}"; write route params as "[param]" (e.g. "/recepti/[id]")`)
    for (const param of route.match(/:(\w+)/g) ?? []) {
      const name = param.slice(1)
      if (!expo.includes(`[${name}]`)) errors.push(`routeMap["${route}"] is "${expo}" and is missing the param "[${name}]"`)
    }
    const other = expoPaths.get(expo)
    if (other) errors.push(`routes "${other}" and "${route}" both map to "${expo}" in routeMap`)
    expoPaths.set(expo, route)
  }
  for (const key of Object.keys(plan.routeMap).sort()) {
    if (!parsedRoutes.has(key)) errors.push(`routeMap has an entry for "${key}", which is not a route of the app`)
  }

  // 13. Flows: unique ids, made of existing screens.
  const flowIds = new Set<string>()
  for (const flow of plan.flows) {
    if (flowIds.has(flow.id)) errors.push(`flow id "${flow.id}" is used more than once`)
    flowIds.add(flow.id)
    for (const id of flow.unitIds) {
      const unit = byId.get(id)
      if (!unit) errors.push(`flow "${flow.id}" uses unknown unit "${id}"`)
      else if (unit.kind !== "screen") errors.push(`flow "${flow.id}" uses shared unit "${id}"; flows are made of screens`)
    }
    if (new Set(flow.unitIds).size !== flow.unitIds.length) errors.push(`flow "${flow.id}" lists the same unit more than once`)
  }

  return errors
}
