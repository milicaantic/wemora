import { exec } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import type { ServedApp } from "../contracts"
import { serveStatic } from "./serve"

// serveOriginal (D-014, PD5): builds the original web app and serves its static output on a free local port,
// so `wemora migrate` no longer needs --original-url. Data the app reads (examples/mock-api for Recepti) is not
// started here: it keeps the URL it was built with (e.g. VITE_API_URL), see README.

const run = promisify(exec)
const BUILD_TIMEOUT_MS = 5 * 60_000

export type ServeOriginalOptions = {
  /** Build before serving (default). false serves what is already in the output folder. */
  build?: boolean
  /** Build output folder inside webDir; Vite and the webpack setup of the examples both use dist. */
  outDir?: string
}

export async function serveOriginal(webDir: string, options: ServeOriginalOptions = {}): Promise<ServedApp> {
  const dir = path.resolve(webDir)
  const outDir = path.join(dir, options.outDir ?? "dist")

  if (options.build ?? true) {
    const manifest = path.join(dir, "package.json")
    if (!existsSync(manifest)) throw new Error(`${manifest} not found: ${dir} is not a web app folder`)
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
      scripts?: Record<string, string>
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    if (!pkg.scripts?.build) throw new Error(`${manifest} has no "build" script, so the original cannot be built`)
    const needsModules = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0
    if (needsModules && !existsSync(path.join(dir, "node_modules"))) {
      throw new Error(`${dir} has no node_modules: run "npm ci" in ${dir} once, then try again`)
    }
    try {
      await run("npm run build", { cwd: dir, env: process.env, timeout: BUILD_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 })
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string }
      const tail = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim().split("\n").slice(-15).join("\n")
      throw new Error(`"npm run build" failed in ${dir}:\n${tail || err.message}`)
    }
  }

  if (!existsSync(path.join(outDir, "index.html"))) {
    throw new Error(`${path.join(outDir, "index.html")} not found: the build did not write the app to ${outDir}`)
  }
  return serveStatic(outDir)
}
