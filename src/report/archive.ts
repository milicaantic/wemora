import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { buildReport } from "./build"

// Copies a finished run (output/<run-id>/) into runs/<name>/ so it can be committed and checked
// later with `npm run verify -- runs/<name>`. Only the proof is kept: no dependencies, no build
// output, no drafts, no huge files.

/** Folder names skipped at any depth: dependencies and build output, rebuilt from the template. */
const SKIPPED_DIRS = new Set(["node_modules", ".expo", "dist", "web-build"])
/** Top-level folders skipped: builder drafts (staging/) are not proof. */
const SKIPPED_TOP = new Set(["staging"])
export const MAX_ARCHIVED_FILE_BYTES = 5 * 1024 * 1024

export type ArchiveSkip = { path: string; why: string }

const NAME = /^[a-z0-9][a-z0-9._-]*$/i

/**
 * Copies runDir into runsDir/name and rebuilds report.html there. Returns the new folder.
 * Throws when runDir is not a run, the name is not a plain folder name, or the target exists.
 * What was left out is listed in <name>/archive.json.
 */
export async function archiveRun(runDir: string, runsDir: string, name: string): Promise<string> {
  if (!NAME.test(name)) throw new Error(`archive name "${name}" must be one folder name: letters, digits, ".", "_", "-"`)
  const source = path.resolve(runDir)
  if (!existsSync(path.join(source, "plan.json")) && !existsSync(path.join(source, "run.jsonl"))) {
    throw new Error(`${source} is not a run folder (no plan.json and no run.jsonl)`)
  }
  const target = path.resolve(runsDir, name)
  if (existsSync(target)) throw new Error(`${target} already exists; pick another name or delete it first`)

  const skipped: ArchiveSkip[] = []
  copyTree(source, target, "", skipped)
  writeFileSync(
    path.join(target, "archive.json"),
    `${JSON.stringify({ source: path.basename(source), skipped: skipped.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2)}\n`,
  )
  await buildReport(target)
  return target
}

function copyTree(from: string, to: string, relative: string, skipped: ArchiveSkip[]): void {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from).sort()) {
    const rel = relative === "" ? entry : `${relative}/${entry}`
    const source = path.join(from, entry)
    // lstat: a link (app/node_modules points at the template) is never followed.
    const stat = lstatSync(source)
    if (stat.isSymbolicLink()) {
      skipped.push({ path: rel, why: "link" })
    } else if (stat.isDirectory()) {
      if (SKIPPED_DIRS.has(entry)) skipped.push({ path: rel, why: "dependencies or build output" })
      else if (relative === "" && SKIPPED_TOP.has(entry)) skipped.push({ path: rel, why: "builder drafts are not proof" })
      else copyTree(source, path.join(to, entry), rel, skipped)
    } else if (stat.isFile()) {
      if (stat.size > MAX_ARCHIVED_FILE_BYTES) skipped.push({ path: rel, why: `larger than ${MAX_ARCHIVED_FILE_BYTES / 1024 / 1024} MB` })
      else if (relative === "" && entry === "report.html") continue // rebuilt from the copy
      else copyFileSync(source, path.join(to, entry))
    }
  }
}
