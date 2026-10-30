// Kapija 3: nacrt ubačen u aplikaciju nema grešaka tipova.
// Radi nad privremenom kopijom `app/` sa nacrtom preko `src/`, TypeScriptom iz šablona.
import { execFile } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import type { Gate } from "./types"

const run = promisify(execFile)
const SKIP = /[\\/](node_modules|dist|\.expo)$/
const MAX_ERRORS = 15

export const tscGate: Gate = async ({ draftDir, appDir }) => {
  const modules = join(appDir, "node_modules")
  if (!existsSync(join(modules, "typescript/bin/tsc"))) {
    // Greška okruženja, ne buildera.
    return {
      gate: "tsc",
      ok: false,
      message: `Gatekeeper: nema TypeScripta u ${modules}. Pokreni "npm install" u templates/expo.`,
    }
  }

  const work = mkdtempSync(join(tmpdir(), "wemora-tsc-"))
  try {
    cpSync(appDir, work, { recursive: true, filter: (src) => !SKIP.test(src) })
    symlinkSync(realpathSync(modules), join(work, "node_modules"), "junction")
    cpSync(draftDir, join(work, "src"), { recursive: true })

    const tsc = join(work, "node_modules/typescript/bin/tsc")
    try {
      await run(process.execPath, [tsc, "--noEmit", "--pretty", "false", "-p", work], { cwd: work, maxBuffer: 16 * 1024 * 1024 })
      return { gate: "tsc", ok: true, message: "Nema grešaka tipova." }
    } catch (e) {
      const out = String((e as { stdout?: string }).stdout ?? "")
      const errors = out.split("\n").filter((l) => /error TS\d+/.test(l)).map((l) => shownTscLine(l, draftDir))
      if (errors.length === 0) return { gate: "tsc", ok: false, message: `tsc nije uspeo:\n${out.slice(0, 2000)}` }
      const more = errors.length > MAX_ERRORS ? `\n… i još ${errors.length - MAX_ERRORS}` : ""
      return {
        gate: "tsc",
        ok: false,
        message: `Greške tipova (${errors.length}):\n${errors.slice(0, MAX_ERRORS).join("\n")}${more}`,
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

/**
 * "src/screens/x/index.tsx(12,5): error TS2339: …" → "screens/x/index.tsx:12: TS2339: …"
 * Fajlovi koji nisu iz nacrta dobijaju prefiks "app/", da builder vidi da je greška u postojećem kodu.
 */
function shownTscLine(line: string, draftDir: string): string {
  const m = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/.exec(line.trim())
  if (!m) return line.trim()
  const [, file, ln, code, text] = m
  const path = file!.split("\\").join("/")
  const inDraft = path.startsWith("src/") && existsSync(join(draftDir, path.slice(4)))
  return `${inDraft ? path.slice(4) : `app/${path}`}:${ln}: ${code}: ${text}`
}
