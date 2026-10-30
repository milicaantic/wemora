// promote: nacrt ide u app/src/, a prethodno stanje se pamti; rollback ga vraća.
//
// Ugovor ne prosleđuje putanju aplikacije, pa se ona izvodi iz rasporeda (architecture §7):
// nacrt je output/<run>/staging/<builderId>/<unitId>/, aplikacija je output/<run>/app/.
// Prethodno stanje se čuva u memoriji: rollback radi u okviru istog prolaza.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import type { Promote, Rollback } from "../contracts"

type Saved = {
  srcDir: string
  /** Putanja u app/src/ → sadržaj pre promocije, ili null ako fajl nije postojao. */
  files: Map<string, Buffer | null>
  /** Folderi u app/src/ koji su postojali pre promocije. */
  dirs: Set<string>
}

const saved = new Map<string, Saved>()

/** output/<run>/staging/<builderId>/<unitId>/ → output/<run>/app/ */
export function appDirOf(draftDir: string): string {
  const staging = dirname(dirname(resolve(draftDir)))
  if (basename(staging) !== "staging") {
    throw new Error(`Nacrt "${draftDir}" nije u output/<run>/staging/<builderId>/<unitId>/.`)
  }
  const appDir = join(dirname(staging), "app")
  if (!existsSync(join(appDir, "src"))) throw new Error(`Nema aplikacije: "${join(appDir, "src")}" ne postoji.`)
  return appDir
}

/** Svi fajlovi i folderi ispod `dir`, kao relativne putanje sa "/". */
function tree(dir: string): { files: string[]; dirs: string[] } {
  const files: string[] = []
  const dirs: string[] = []
  const walk = (rel: string) => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        dirs.push(p)
        walk(p)
      } else files.push(p)
    }
  }
  if (existsSync(dir)) walk("")
  return { files, dirs }
}

export const promote: Promote = async (unitId, draftDir) => {
  const srcDir = join(appDirOf(draftDir), "src")
  const draft = tree(draftDir).files
  if (draft.length === 0) throw new Error(`Nacrt jedinice "${unitId}" je prazan.`)

  // Folder jedinice se menja ceo: fajlovi kojih nema u nacrtu se brišu (npr. preimenovani).
  const before = tree(srcDir)
  const owned = [`screens/${unitId}/`, `shared/${unitId}/`].filter((d) => draft.some((f) => f.startsWith(d)))
  const stale = before.files.filter((f) => owned.some((d) => f.startsWith(d)) && !draft.includes(f))

  const files = new Map<string, Buffer | null>()
  for (const f of [...draft, ...stale]) {
    const p = join(srcDir, f)
    files.set(f, existsSync(p) ? readFileSync(p) : null)
  }
  saved.set(unitId, { srcDir, files, dirs: new Set(before.dirs) })

  for (const f of stale) rmSync(join(srcDir, f))
  for (const f of draft) {
    mkdirSync(dirname(join(srcDir, f)), { recursive: true })
    writeFileSync(join(srcDir, f), readFileSync(join(draftDir, f)))
  }
}

export const rollback: Rollback = async (unitId) => {
  const s = saved.get(unitId)
  if (!s) throw new Error(`Nema promocije jedinice "${unitId}" koja može da se vrati.`)

  for (const [f, content] of s.files) {
    const p = join(s.srcDir, f)
    if (content === null) rmSync(p, { force: true })
    else {
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, content)
    }
  }
  // Folderi koje je napravila promocija, od najdubljeg ka gore.
  const created = tree(s.srcDir).dirs.filter((d) => !s.dirs.has(d)).sort((a, b) => b.length - a.length)
  for (const d of created) {
    const p = join(s.srcDir, d)
    if (readdirSync(p).length === 0) rmdirSync(p)
  }
  saved.delete(unitId)
}
