// serveApp: statički web export aplikacije (D-006) na slobodnom lokalnom portu.
// Export ide u privremeni folder (ne u app/); close() gasi server i briše ga.
// Servira se B-ovim serveStatic, isto kao u runScenarios i verify.
import { execFile } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import type { ServeApp } from "../contracts"
import { serveStatic } from "../scenarios/index"

const run = promisify(execFile)

export const serveApp: ServeApp = async (appDir) => {
  const cli = join(appDir, "node_modules/expo/bin/cli")
  if (!existsSync(cli)) throw new Error(`Nema Expo CLI u "${cli}". Pokreni "npm install" u templates/expo.`)

  const out = mkdtempSync(join(tmpdir(), "wemora-web-"))
  try {
    // Nikad --clear: keš drži export na ~6 s (D-006).
    await run(process.execPath, [cli, "export", "--platform", "web", "--output-dir", out], {
      cwd: appDir,
      env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
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
