// "Build" of the test web app for serveOriginal: writes dist/index.html, or fails when FAIL_BUILD is set.
import { mkdirSync, writeFileSync } from "node:fs"

if (process.env.FAIL_BUILD) {
  console.error("build failed on purpose")
  process.exit(1)
}
mkdirSync("dist", { recursive: true })
writeFileSync("dist/index.html", `<!doctype html><html lang="sr"><body><h1>Original</h1><p>Built ${"for serveOriginal"}</p></body></html>\n`)
