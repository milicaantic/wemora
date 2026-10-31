// serveApp: statički web export aplikacije (D-006) na slobodnom lokalnom portu.
// Export ide u privremeni folder (ne u app/); close() gasi server i briše ga.
// Servira se B-ovim serveStatic, isto kao u runScenarios i verify.
import { execFile } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import type { ServeApp } from "../contracts"
import { serveStatic } from "../scenarios/index"

const run = promisify(execFile)

/**
 * Okruženje za web export. Mobilna aplikacija mora da čita isti mock-api kao original (architecture §11):
 * EXPO_PUBLIC_API_URL iz okruženja; ako ga nema, VITE_API_URL (adresa originala); ako ni nje nema,
 * vrednost iz app/.env.example (šablon: http://localhost:3000, isti podrazumevani kao Recepti).
 * Bez ovoga je API_URL prazan, fetch ide na statički server i ekrani ostaju na „Učitavanje…“ (A → C, G3).
 */
export function exportEnv(appDir: string, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env, CI: "1", EXPO_NO_TELEMETRY: "1" }
  if (!out.EXPO_PUBLIC_API_URL) {
    const fromExample = readEnvExample(join(appDir, ".env.example")).EXPO_PUBLIC_API_URL
    const url = out.VITE_API_URL || fromExample
    if (url) out.EXPO_PUBLIC_API_URL = url
  }
  return out
}

function readEnvExample(file: string): Record<string, string> {
  if (!existsSync(file)) return {}
  const vars: Record<string, string> = {}
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && m[2]) vars[m[1]!] = m[2].replace(/^["']|["']$/g, "")
  }
  return vars
}

export const serveApp: ServeApp = async (appDir) => {
  const cli = join(appDir, "node_modules/expo/bin/cli")
  if (!existsSync(cli)) throw new Error(`Nema Expo CLI u "${cli}". Pokreni "npm install" u templates/expo.`)

  const out = mkdtempSync(join(tmpdir(), "wemora-web-"))
  try {
    // Nikad --clear: keš drži export na ~6 s (D-006).
    await run(process.execPath, [cli, "export", "--platform", "web", "--output-dir", out], {
      cwd: appDir,
      env: exportEnv(appDir),
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (e) {
    rmSync(out, { recursive: true, force: true })
    const err = e as { stdout?: string; stderr?: string }
    const log = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim().split("\n").slice(-20).join("\n")
    throw new Error(`Web export aplikacije nije uspeo:\n${log}`)
  }

  const served = await serveStatic(out)
  return {
    url: served.url,
    close: async () => {
      await served.close()
      rmSync(out, { recursive: true, force: true })
    },
  }
}
