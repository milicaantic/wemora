import { PlanSchema, type Plan, type Unit, type ValidatePlan } from "../contracts"
import { knownSourceFiles } from "./styles"

// Checks a plan against the parser's view of the app (docs/architecture.md §8).
// Messages are in English and name the exact unit, file or route, because the architect
// model gets them back and has to fix the plan from them alone.

const ID = /^[a-z0-9][a-z0-9-]*$/

const ownPrefix = (unit: Unit) => `src/${unit.kind === "screen" ? "screens" : "shared"}/${unit.id}/`
/** Root layout of Expo Router; only the shared unit "layout" may write it (rule 9). */
const ROOT_LAYOUT = "src/app/_layout.tsx"
const list = (items: string[]) => items.map((x) => `"${x}"`).join(", ")
const overlaps = (a: string, b: string) => a.startsWith(b) || b.startsWith(a)

// Gestures the test DSL has no step for (architecture.md §11). Quoted texts are UI texts, so they are skipped.
const GESTURES: [RegExp, string][] = [
  [/\blong[- ]?(press|tap)\w*/i, "a long press"],
  [/\bhover\w*/i, "mouse hover"],
  [/\bdouble[- ]?(click|tap)\w*|\bdblclick\b/i, "a double click"],
  [/\bdrag\w*|\bswip\w*/i, "dragging or swiping"],
  [/\bright[- ]?click\w*|\bcontext menu\b/i, "a right click"],
  [/\bkeyboard shortcut\w*|\bpress(es|ing)? (escape|esc|tab|arrow\w*|ctrl|cmd)\b/i, "a keyboard shortcut"],
]
const QUOTED = /'[^'\n]*'|"[^"\n]*"|‘[^’\n]*’|“[^”\n]*”/g

function untestableGesture(description: string): string | null {
  const plain = description.replace(QUOTED, "''")
  return GESTURES.find(([pattern]) => pattern.test(plain))?.[1] ?? null
}

// Checks the test DSL cannot make: it only sees whether a text is shown or not, so it cannot compare
// an order or count items (A, docs/inbox 2026-10-31, G3). Narrow on purpose: "orders" alone may be data.
const NAVIGATION = "what another screen shows"
const UNCHECKABLE: [RegExp, string][] = [
  [/\bsort(s|ed|ing)?\b|\b(re)?orders? (them |the \w+ |\w+ )?(by|from)\b|\b(same|original|reverse|new|different) order\b|\bascending\b|\bdescending\b|\balphabetical(ly)?\b/i, "an order of items"],
  [/\bduplicates?\b|\btwice\b|\bhow many\b|\bonly once\b|\bmore than once\b|\bexactly (one|two|three|\d+)\b/i, "counting items"],
  // A screen is checked while the other screens may still be empty in app/, so its test may not look at
  // another screen (A, inbox 2026-10-31: recipe-list and recipe-detail blocked each other).
  [/\bnavigat\w* (back )?to\b|\b(goes|go|returns?|takes \w+) (back )?to (the|its|that|a)\b|\bopens (the|its|that|a) [\w' -]{0,40}?\b(screen|page)\b/i, NAVIGATION],
]

function uncheckable(description: string): string | null {
  const plain = description.replace(QUOTED, "''")
  return UNCHECKABLE.find(([pattern]) => pattern.test(plain))?.[1] ?? null
}

// A screen is checked while the other screens may still be empty, so its obligation may not need a state
// made on another screen (A, inbox 2026-10-31: favorites "added via the recipe list flow" was given up).
const ELSEWHERE =
  /\b(added|marked|created|saved|selected|put) (via|from|on|in|through) (the|a|an|another) [\w' -]{0,30}?\b(list|screen|page|flow|detail)\b|\bvia the [\w' -]{0,30}?\bflow\b|\b(on|in|from) (another|the other|a different) (screen|page)\b|\bafter (a|an|the) [\w' -]{0,40}? (appears|is added|has been added|was added) (on|in) this screen\b/i

const routePattern = (route: string) =>
  new RegExp(`^${route.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/:[\w]+\??/g, "[^/]+").replace(/\*/g, ".*")}/?$`)

/** A route of another screen named in the description ('/omiljeni', "/kupovina", /recepti/4), or null. */
function otherScreenRoute(description: string, own: string | undefined, others: string[]): string | null {
  const paths = [...description.matchAll(/'(\/[^'\s]*)'|"(\/[^"\s]*)"|(?<![\w'"/])(\/[a-z0-9][\w\-/:]*)/gi)].map((m) => m[1] ?? m[2] ?? m[3]!)
  for (const path of paths) {
    if (own && routePattern(own).test(path)) continue
    const other = others.find((route) => routePattern(route).test(path))
    if (other) return other
  }
  return null
}

const mentions = (description: string, name: string) =>
  [`'${name}'`, `"${name}"`, `‘${name}’`, `“${name}”`].some((quoted) => description.includes(quoted))

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
  // Package stylesheets imported by shared code count too: they belong to the theme unit (D-027).
  const knownFiles = knownSourceFiles(parsed)
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
  // The one exception (C, PD3/PD4): the shared unit "layout" may also write the root layout of Expo Router.
  for (const unit of units) {
    if (unit.writes.length === 0) errors.push(`unit "${unit.id}" has no writes; use ["${ownPrefix(unit)}"]`)
    for (const path of unit.writes) {
      if (path === ROOT_LAYOUT && unit.kind === "shared" && unit.id === "layout") continue
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
  const otherScreenRoutes = (self: Unit) =>
    units.flatMap((u) => (u.kind === "screen" && u.id !== self.id && typeof u.route === "string" ? [u.route] : []))
  for (const unit of units) {
    if (unit.kind === "screen" && unit.obligations.length === 0) {
      errors.push(`screen unit "${unit.id}" has no obligations; list the behaviors its tests must cover`)
    }
    if (unit.kind === "shared" && unit.obligations.length > 0) {
      errors.push(`shared unit "${unit.id}" must not have obligations; shared units are proven through the screens that use them`)
    }
    const seen = new Set<string>()
    const notPortable = unit.intentionalDifferences.flatMap((d) => (d.kind === "notPortable" ? [d.element.name] : []))
    for (const obligation of unit.obligations) {
      if (seen.has(obligation.id)) errors.push(`unit "${unit.id}" has obligation id "${obligation.id}" more than once`)
      seen.add(obligation.id)
      if (!ID.test(obligation.id)) errors.push(`obligation id "${obligation.id}" in unit "${unit.id}" must be kebab-case`)
      // Tests must pass on the original web with the DSL steps only (A, docs/inbox 2026-10-31).
      const gesture = untestableGesture(obligation.description)
      if (gesture) {
        errors.push(
          `obligation "${obligation.id}" of unit "${unit.id}" needs ${gesture}, which a test cannot do; tests run on the original web with only goto, tap, fill, submit (type and press Enter), expectVisible and expectNotVisible on named elements. Rewrite it with those steps, or drop it and keep the element in intentionalDifferences`,
        )
      }
      const check = uncheckable(obligation.description)
      if (check) {
        errors.push(
          check === NAVIGATION
            ? `obligation "${obligation.id}" of unit "${unit.id}" checks ${check}; screens are checked while other screens may still be empty, so this test would block both. Say only that this screen is left (a text that exists only on this screen is no longer shown) and put what the other screen shows into a flow`
            : `obligation "${obligation.id}" of unit "${unit.id}" checks ${check}, which a test cannot do: a test only sees whether a text is shown or not. Rewrite it so that after the action a text appears or disappears, or drop it (if its element then has no testable effect, list the element as notPortable and say why)`,
        )
      }
      if (unit.kind === "screen") {
        const otherRoute = otherScreenRoute(obligation.description, unit.route, otherScreenRoutes(unit))
        const elsewhere = ELSEWHERE.exec(obligation.description.replace(QUOTED, "''"))?.[0]
        if (otherRoute || elsewhere) {
          const what = otherRoute ? `the route "${otherRoute}" of another screen` : `a state made elsewhere ("${elsewhere}")`
          errors.push(
            `obligation "${obligation.id}" of unit "${unit.id}" names ${what}; a screen is checked while the other screens may still be empty, so its obligations may only use this screen. Keep what this screen shows on its own (for example its empty state) and put the rest into a flow`,
          )
        }
      }
      for (const name of notPortable) {
        if (mentions(obligation.description, name)) {
          errors.push(
            `obligation "${obligation.id}" of unit "${unit.id}" uses '${name}', which the same unit marks notPortable, so no test can use it; drop the obligation or describe it with another named element`,
          )
        }
      }
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
