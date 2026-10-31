import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { PlanSchema, UnitResultSchema, type Sabotage, type Step } from "../contracts"
import { readTests } from "../scenarios"

// sabotage (wemora-plan.md §2.7, G3): breaks one promoted screen of a finished run on purpose, so `verify` must fail
// on exactly that screen. It edits the run folder in place: run it on a copy of a run, never on the only one.

export const SABOTAGE_MARK = "[sabotaged]"

export type SabotageChange = {
  unitId: string
  /** The screen file that was changed, relative to the run folder. */
  file: string
  /** The name or text the tests look for, now replaced by SABOTAGE_MARK. */
  target: string
  kind: "label" | "name" | "text"
}

/** Like `sabotage`, but says what it changed, for the CLI to print. */
export async function sabotageDetailed(input: string, unitId: string): Promise<SabotageChange> {
  const runDir = path.resolve(input)
  const plan = PlanSchema.parse(JSON.parse(readFileSync(path.join(runDir, "plan.json"), "utf8")))
  const unit = plan.units.find((u) => u.id === unitId)
  if (!unit) throw new Error(`unit "${unitId}" is not in the plan; screens: ${plan.units.filter((u) => u.kind === "screen").map((u) => u.id).join(", ")}`)
  if (unit.kind !== "screen") throw new Error(`unit "${unitId}" is shared: it has no tests of its own, so verify could not show the damage`)

  const resultFile = path.join(runDir, "results", `${unitId}.json`)
  const status = existsSync(resultFile) ? UnitResultSchema.parse(JSON.parse(readFileSync(resultFile, "utf8"))).status : null
  if (status !== "proven" && status !== "partial") {
    throw new Error(`screen "${unitId}" has status ${status ?? "none"}: verify counts only proven and partial screens, so the sabotage would not show`)
  }
  const tests = readTests(runDir, unitId)
  if (tests.length === 0) throw new Error(`screen "${unitId}" has no tests`)

  const screenDir = path.join(runDir, "app", "src", "screens", unitId)
  const files = sourceFiles(screenDir)
  if (files.some((f) => readFileSync(f, "utf8").includes(SABOTAGE_MARK))) {
    throw new Error(`screen "${unitId}" is already sabotaged (${SABOTAGE_MARK} in ${path.relative(runDir, screenDir)})`)
  }

  for (const candidate of targets(tests.flatMap((t) => [...(t.setup ?? []), ...t.steps]))) {
    for (const file of files) {
      const code = readFileSync(file, "utf8")
      const pattern = literal(candidate.target)
      if (!pattern.test(code)) continue
      writeFileSync(file, code.replace(literal(candidate.target, "g"), `$1${SABOTAGE_MARK}$2`))
      return { unitId, file: path.relative(runDir, file), ...candidate }
    }
  }
  throw new Error(`none of the names or texts in the tests of "${unitId}" is written in ${path.relative(runDir, screenDir)}, so there is nothing to break`)
}

export const sabotage: Sabotage = async (runDir, unitId) => {
  await sabotageDetailed(runDir, unitId)
}

// What the tests look for, most telling first: a field label, then a name with a role, then visible text.
function targets(steps: Step[]): { target: string; kind: SabotageChange["kind"] }[] {
  const labels: string[] = []
  const names: string[] = []
  const texts: string[] = []
  for (const step of steps) {
    if ("fill" in step) labels.push(step.fill.label)
    else if ("submit" in step) labels.push(step.submit.label)
    else if ("tap" in step) ("role" in step.tap ? names : texts).push("role" in step.tap ? step.tap.name : step.tap.text)
    else if ("expectVisible" in step) texts.push(step.expectVisible.text)
  }
  const seen = new Set<string>()
  const ordered = [
    ...labels.map((target) => ({ target, kind: "label" as const })),
    ...names.map((target) => ({ target, kind: "name" as const })),
    ...texts.map((target) => ({ target, kind: "text" as const })),
  ]
  return ordered.filter(({ target }) => !seen.has(target) && seen.add(target))
}

// The target only where it is a string or JSX text ("…", '…', `…`, >…<), never inside an identifier like `todos.map`.
function literal(target: string, flags = ""): RegExp {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(["'\`>]\\s*)${escaped}(\\s*["'\`<])`, flags)
}

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(full)
      return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : []
    })
}
