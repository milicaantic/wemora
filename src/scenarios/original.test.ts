import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, afterEach, describe, expect, it } from "vitest"
import { serveOriginal } from "./original"

// A copy of the test web app in src/scenarios/mocks/webapp/, so nothing is built inside the repo.
const fixture = fileURLToPath(new URL("./mocks/webapp", import.meta.url))
const copies: string[] = []
function copyOfWebApp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "wemora-original-"))
  cpSync(fixture, dir, { recursive: true })
  copies.push(dir)
  return dir
}

afterEach(() => {
  delete process.env.FAIL_BUILD
})
afterAll(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true })
})

describe("serveOriginal", { timeout: 60_000 }, () => {
  it("builds the app and serves its output, with SPA routes falling back to index.html", async () => {
    const app = await serveOriginal(copyOfWebApp())
    try {
      expect(await (await fetch(app.url)).text()).toContain("<h1>Original</h1>")
      expect(await (await fetch(`${app.url}/recepti/4`)).text()).toContain("<h1>Original</h1>")
    } finally {
      await app.close()
    }
  })

  it("serves an existing build without building again when asked", async () => {
    const dir = copyOfWebApp()
    await (await serveOriginal(dir)).close()
    writeFileSync(path.join(dir, "build.mjs"), 'throw new Error("must not build")\n')
    const app = await serveOriginal(dir, { build: false })
    await app.close()
  })

  it("shows the end of the build output when the build fails", async () => {
    process.env.FAIL_BUILD = "1"
    await expect(serveOriginal(copyOfWebApp())).rejects.toThrow(/"npm run build" failed[\s\S]*build failed on purpose/)
  })

  it("says what is missing: no package.json, no build script, no node_modules, no output", async () => {
    const empty = mkdtempSync(path.join(tmpdir(), "wemora-original-empty-"))
    copies.push(empty)
    await expect(serveOriginal(empty)).rejects.toThrow(/package\.json not found/)

    writeFileSync(path.join(empty, "package.json"), JSON.stringify({ scripts: {} }))
    await expect(serveOriginal(empty)).rejects.toThrow(/has no "build" script/)

    writeFileSync(path.join(empty, "package.json"), JSON.stringify({ scripts: { build: "node -e 0" }, dependencies: { react: "18.3.1" } }))
    await expect(serveOriginal(empty)).rejects.toThrow(/run "npm ci"/)

    await expect(serveOriginal(empty, { build: false })).rejects.toThrow(/index\.html not found/)
  })
})
