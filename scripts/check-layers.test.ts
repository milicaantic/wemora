import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { checkLayers } from "./check-layers"

const dirs: string[] = []

// Writes a fake src/ tree into a temp folder and returns its path.
function project(files: Record<string, string>): string {
  const src = path.join(mkdtempSync(path.join(tmpdir(), "layers-")), "src")
  dirs.push(path.dirname(src))
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(src, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, text)
  }
  return src
}

const rules = (srcDir: string) => checkLayers(srcDir).map((v) => v.rule)

// A small tree that follows every rule.
const clean = {
  "contracts/index.ts": `import { z } from "zod"\nexport const S = z.string()`,
  "contracts/x.test.ts": `import { it } from "vitest"\nimport { S } from "./index"`,
  "core/config.ts": `import type { S } from "../contracts"\nexport const n = 1`,
  "core/runner.ts": `import { supportedModels } from "@mozaik-ai/core"\nexport const m = supportedModels`,
  "core/runtime.ts": `import { defineRuntime } from "@mozaik-ai/core"\nexport const r = defineRuntime()`,
  "scenarios/index.ts": `import { n } from "../core/config"\nexport * from "./run"`,
  "scenarios/run.ts": `import { readFileSync } from "node:fs"\nexport const run = 1`,
  "verify/index.ts": `import { run } from "../scenarios"\nexport const v = run`,
  "agents/tester.ts": `import { createAgent } from "@mozaik-ai/core"\nimport { run } from "../scenarios/index"`,
  "orchestration/conductor.ts": `import "../agents/tester"\nimport { m } from "../core/runner"`,
  "cli.ts": `const o = await import("./orchestration/conductor")\n// defineRuntime() mentioned in a comment`,
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe("checkLayers", () => {
  it("accepts a tree that follows the rules", () => {
    expect(checkLayers(project(clean))).toEqual([])
  })

  it("rejects a domain file that imports Mozaik", () => {
    const src = project({ ...clean, "scenarios/index.ts": `import "@mozaik-ai/core"` })
    const [violation] = checkLayers(src)
    expect(violation).toMatchObject({ file: "src/scenarios/index.ts", line: 1, rule: "domain-no-mozaik" })
  })

  it("rejects a domain file that reaches Mozaik through core", () => {
    const src = project({ ...clean, "verify/index.ts": `import { m } from "../core/runner"` })
    const [violation] = checkLayers(src)
    expect(violation.rule).toBe("domain-no-mozaik")
    expect(violation.message).toContain("verify/index.ts → core/runner.ts → @mozaik-ai/core")
  })

  it("rejects importing another domain folder past its index.ts", () => {
    expect(rules(project({ ...clean, "verify/index.ts": `import { run } from "../scenarios/run"` }))).toEqual([
      "domain-via-index",
    ])
  })

  it("rejects Mozaik in core files other than runtime, state and runner", () => {
    expect(rules(project({ ...clean, "core/log.ts": `import { SemanticEvent } from "@mozaik-ai/core"` }))).toEqual([
      "core-mozaik",
    ])
  })

  it("lets core test files import Mozaik, but not domain test files", () => {
    const src = project({
      ...clean,
      "core/runtime.test.ts": `import { createHuman } from "@mozaik-ai/core"`,
      "scenarios/run.test.ts": `import { createHuman } from "@mozaik-ai/core"`,
    })
    expect(checkLayers(src)).toEqual([expect.objectContaining({ file: "src/scenarios/run.test.ts", rule: "domain-no-mozaik" })])
  })

  it("rejects contracts importing anything but zod and contracts", () => {
    const src = project({ ...clean, "contracts/bad.ts": `import fs from "node:fs"\nimport { n } from "../core/config"` })
    expect(rules(src)).toEqual(["contracts-imports", "contracts-imports"])
  })

  it("rejects importing an upper layer", () => {
    const src = project({ ...clean, "orchestration/bad.ts": `import "../cli"`, "core/bad.ts": `import "../scenarios"` })
    expect(rules(src).sort()).toEqual(["layer-order", "layer-order"])
  })

  it("rejects defineRuntime outside core/runtime.ts", () => {
    const src = project({ ...clean, "core/state.ts": `import { defineRuntime } from "@mozaik-ai/core"\n\ndefineRuntime()` })
    expect(checkLayers(src)).toEqual([expect.objectContaining({ file: "src/core/state.ts", line: 3, rule: "single-runtime" })])
  })

  it("rejects files outside the known layers", () => {
    expect(rules(project({ ...clean, "utils/helpers.ts": "export const x = 1" }))).toEqual(["unknown-layer"])
  })

  it("passes on the real src/ folder", () => {
    expect(checkLayers("src")).toEqual([])
  })
})
