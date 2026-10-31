import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { archiveRun, MAX_ARCHIVED_FILE_BYTES } from "./index"

const fixture = fileURLToPath(new URL("./mocks/run", import.meta.url))
let root = ""
let runDir = ""
let runsDir = ""

const put = (file: string, text = "x") => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

// A finished run as the CLI leaves it, with everything that must not be committed.
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "wemora-archive-"))
  runDir = path.join(root, "output", "20261031-120000-todomvc")
  runsDir = path.join(root, "runs")
  cpSync(fixture, runDir, { recursive: true })
  put(path.join(runDir, "analysis", "part-1.json"), "[]")
  put(path.join(runDir, "report.html"), "old report")
  put(path.join(runDir, "app", "package.json"), "{}")
  put(path.join(runDir, "app", "src", "screens", "recipe-list", "index.tsx"), "export default function A() { return null }")
  put(path.join(runDir, "app", "node_modules", "react", "index.js"))
  put(path.join(runDir, "app", ".expo", "metro-cache", "x"))
  put(path.join(runDir, "app", "dist", "index.html"))
  put(path.join(runDir, "app", "src", "web-build", "x.js"))
  put(path.join(runDir, "staging", "builder-1", "recipe-list", "index.tsx"))
  writeFileSync(path.join(runDir, "app", "big.bin"), Buffer.alloc(MAX_ARCHIVED_FILE_BYTES + 1))
  // Like app/node_modules → templates/expo/node_modules in a real run; "junction" needs no admin on Windows.
  const template = path.join(root, "template-modules")
  put(path.join(template, "expo", "index.js"))
  symlinkSync(template, path.join(runDir, "app", "linked_modules"), "junction")
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe("archiveRun", () => {
  it("copies the proof and leaves out dependencies, build output, drafts, links and huge files", async () => {
    const target = await archiveRun(runDir, runsDir, "todomvc-test")
    expect(target).toBe(path.join(runsDir, "todomvc-test"))

    for (const kept of ["plan.json", "run.jsonl", "analysis/part-1.json", "tests/recipe-list.json", "results/recipe-list.json", "app/package.json", "app/src/screens/recipe-list/index.tsx"]) {
      expect(existsSync(path.join(target, kept)), kept).toBe(true)
    }
    for (const left of ["app/node_modules", "app/.expo", "app/dist", "app/src/web-build", "staging", "app/big.bin", "app/linked_modules"]) {
      expect(existsSync(path.join(target, left)), left).toBe(false)
    }

    const manifest = JSON.parse(readFileSync(path.join(target, "archive.json"), "utf8"))
    expect(manifest.source).toBe("20261031-120000-todomvc")
    expect(manifest.skipped.map((s: { path: string }) => s.path)).toEqual([
      "app/.expo",
      "app/big.bin",
      "app/dist",
      "app/linked_modules",
      "app/node_modules",
      "app/src/web-build",
      "staging",
    ])
  })

  it("builds report.html again from the copy", () => {
    const html = readFileSync(path.join(runsDir, "todomvc-test", "report.html"), "utf8")
    expect(html).not.toBe("old report")
    expect(html).toContain("Wemora izveštaj todomvc-test")
  })

  it("never overwrites an archive, and refuses names with paths or folders that are not runs", async () => {
    await expect(archiveRun(runDir, runsDir, "todomvc-test")).rejects.toThrow("already exists")
    await expect(archiveRun(runDir, runsDir, "../escape")).rejects.toThrow("must be one folder name")
    await expect(archiveRun(path.join(root, "template-modules"), runsDir, "nope")).rejects.toThrow("is not a run folder")
  })
})
