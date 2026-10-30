// Enforces the layer rules from docs/architecture.md §2 and §14 on every import in src/.
// Usage: tsx scripts/check-layers.ts [srcDir]   (exit code 1 when a rule is broken)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { builtinModules } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

export type Violation = { file: string; line: number; rule: string; message: string }

type Layer = "contracts" | "core" | "domain" | "agents" | "orchestration" | "cli"

const DOMAIN_FOLDERS = ["analysis", "scenarios", "gatekeeper", "scaffold", "report", "verify"]
const MOZAIK = "@mozaik-ai/core"
const CORE_MOZAIK_FILES = ["core/runtime.ts", "core/state.ts", "core/runner.ts"]
const RUNTIME_FILE = "core/runtime.ts"

// Which layers each layer may import from (a layer may only use the layers below it).
const ALLOWED: Record<Layer, Layer[]> = {
  contracts: ["contracts"],
  core: ["contracts", "core"],
  domain: ["contracts", "core", "domain"],
  agents: ["contracts", "core", "domain", "agents"],
  orchestration: ["contracts", "core", "domain", "agents", "orchestration"],
  cli: ["contracts", "core", "domain", "agents", "orchestration", "cli"],
}

type Import = { spec: string; line: number; target: string | null; pkg: string | null }
type SourceInfo = { rel: string; layer: Layer | null; isTest: boolean; imports: Import[]; text: string }

export function checkLayers(srcDir: string): Violation[] {
  const root = path.resolve(srcDir)
  const files = new Map<string, SourceInfo>()
  for (const abs of listSourceFiles(root)) {
    const info = readSource(root, abs)
    files.set(info.rel, info)
  }

  const violations: Violation[] = []
  for (const info of files.values()) {
    if (!info.layer) {
      violations.push({ file: info.rel, line: 1, rule: "unknown-layer", message: "file is outside the known layer folders" })
      continue
    }
    for (const imp of info.imports) checkImport(info, imp, violations)
    checkSingleRuntime(info, violations)
    if (info.layer === "domain") checkDomainMozaik(info, files, violations)
  }
  return violations.map((v) => ({ ...v, file: `${path.basename(root)}/${v.file}` }))
}

function checkImport(info: SourceInfo, imp: Import, out: Violation[]): void {
  const add = (rule: string, message: string) => out.push({ file: info.rel, line: imp.line, rule, message })
  const layer = info.layer!

  if (layer === "contracts") {
    const allowedPkg = imp.pkg === "zod" || (info.isTest && imp.pkg === "vitest")
    const localContracts = imp.target !== null && layerOf(imp.target) === "contracts"
    if (!allowedPkg && !localContracts) add("contracts-imports", `contracts may import only zod and other contracts, not "${imp.spec}"`)
    return
  }

  // Tests of core/runtime need real Mozaik participants; the domain rule stays strict for tests too.
  if (imp.pkg === MOZAIK && layer === "core" && !info.isTest && !CORE_MOZAIK_FILES.includes(info.rel)) {
    add("core-mozaik", `only ${CORE_MOZAIK_FILES.join(", ")} may import ${MOZAIK}`)
  }

  if (imp.target === null) return
  const targetLayer = layerOf(imp.target)
  if (targetLayer && !ALLOWED[layer].includes(targetLayer)) {
    add("layer-order", `${layer} must not import ${targetLayer} ("${imp.spec}")`)
  }

  const targetDomain = domainFolderOf(imp.target)
  if (targetDomain && targetDomain !== domainFolderOf(info.rel)) {
    const viaIndex = imp.target === `${targetDomain}/index.ts`
    if (!viaIndex) add("domain-via-index", `import another domain folder only through ${targetDomain}/index.ts ("${imp.spec}")`)
  }
}

// Only core/runtime.ts may call defineRuntime (invariant 2).
function checkSingleRuntime(info: SourceInfo, out: Violation[]): void {
  if (info.rel === RUNTIME_FILE || !info.text.includes("defineRuntime")) return
  const source = ts.createSourceFile(info.rel, info.text, ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "defineRuntime") {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
      out.push({ file: info.rel, line, rule: "single-runtime", message: `only ${RUNTIME_FILE} may call defineRuntime` })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

// Domain must not reach Mozaik directly or through other files (e.g. domain → core/runner.ts → Mozaik).
function checkDomainMozaik(info: SourceInfo, files: Map<string, SourceInfo>, out: Violation[]): void {
  for (const imp of info.imports) {
    const chain = imp.pkg === MOZAIK ? [] : imp.target ? findMozaikChain(imp.target, files, new Set([info.rel])) : null
    if (chain === null) continue
    const route = [info.rel, ...chain, MOZAIK].join(" → ")
    out.push({ file: info.rel, line: imp.line, rule: "domain-no-mozaik", message: `domain must not depend on ${MOZAIK}: ${route}` })
  }
}

function findMozaikChain(rel: string, files: Map<string, SourceInfo>, seen: Set<string>): string[] | null {
  const info = files.get(rel)
  if (!info || seen.has(rel)) return null
  seen.add(rel)
  for (const imp of info.imports) {
    if (imp.pkg === MOZAIK) return [rel]
    if (!imp.target) continue
    const rest = findMozaikChain(imp.target, files, seen)
    if (rest) return [rel, ...rest]
  }
  return null
}

function readSource(root: string, abs: string): SourceInfo {
  const text = readFileSync(abs, "utf8")
  const rel = toPosix(path.relative(root, abs))
  const imports = ts.preProcessFile(text, true, true).importedFiles.map((ref) => {
    const spec = ref.fileName
    const line = text.slice(0, ref.pos).split("\n").length
    if (spec.startsWith(".")) {
      return { spec, line, target: resolveLocal(root, path.dirname(abs), spec), pkg: null }
    }
    return { spec, line, target: null, pkg: packageName(spec) }
  })
  return { rel, layer: layerOf(rel), isTest: rel.endsWith(".test.ts"), imports, text }
}

// Resolves "./x" to a src-relative path ("core/config.ts"); unresolved paths keep a ".ts" guess so layers still apply.
function resolveLocal(root: string, fromDir: string, spec: string): string {
  const base = path.resolve(fromDir, spec.replace(/\.js$/, ""))
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]
  const found = candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? `${base}.ts`
  return toPosix(path.relative(root, found))
}

function packageName(spec: string): string | null {
  if (spec.startsWith("node:") || builtinModules.includes(spec)) return null
  const parts = spec.split("/")
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

function layerOf(rel: string): Layer | null {
  if (rel === "cli.ts") return "cli"
  const top = rel.split("/")[0]
  if (top === "contracts" || top === "core" || top === "agents" || top === "orchestration") return top
  return DOMAIN_FOLDERS.includes(top) ? "domain" : null
}

function domainFolderOf(rel: string): string | null {
  const top = rel.split("/")[0]
  return DOMAIN_FOLDERS.includes(top) && rel.includes("/") ? top : null
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : listSourceFiles(abs)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [abs] : []
  })
}

const toPosix = (p: string) => p.split(path.sep).join("/")

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const srcDir = process.argv[2] ?? "src"
  const violations = checkLayers(srcDir)
  if (violations.length === 0) {
    console.log("check-layers: ok")
  } else {
    console.error(`check-layers: ${violations.length} violation(s)`)
    for (const v of violations) console.error(`  ${v.file}:${v.line}  [${v.rule}] ${v.message}`)
    process.exitCode = 1
  }
}
