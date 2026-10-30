import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { UnsupportedInputError } from "./errors"

export const CODE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"]
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", "__tests__"])
const SKIP_FILE = /\.(test|spec)\.[jt]sx?$|\.d\.ts$/

/** Relative path with forward slashes, the only form used in parser output. */
export const toPosix = (p: string) => p.split(path.sep).join("/")

/** Where the app's code lives: `src/` when it exists, otherwise the project root. */
export function sourceRoot(webDir: string): string {
  const src = path.join(webDir, "src")
  return existsSync(src) ? src : webDir
}

/** Code files under `root`, relative to `webDir`, sorted. CSS is not listed; it enters through imports. */
export function listCodeFiles(webDir: string, root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(path.join(dir, entry.name))
      } else if (CODE_EXTENSIONS.includes(path.extname(entry.name)) && !SKIP_FILE.test(entry.name)) {
        out.push(toPosix(path.relative(webDir, path.join(dir, entry.name))))
      }
    }
  }
  walk(root)
  return out.sort()
}

/** File text with line endings normalized, so sizes do not depend on git's autocrlf. */
export function readText(webDir: string, rel: string): string {
  return readFileSync(path.join(webDir, rel), "utf8").replace(/\r\n/g, "\n")
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.replace(/\r\n/g, "\n").length / 4)
}

// .js files in React projects often contain JSX (TodoMVC does), so they are parsed as JSX.
function scriptKind(rel: string): ts.ScriptKind {
  if (rel.endsWith(".tsx")) return ts.ScriptKind.TSX
  if (rel.endsWith(".ts")) return ts.ScriptKind.TS
  return ts.ScriptKind.JSX
}

/** Parses one file and throws a parse-error with file:line when the syntax is broken. */
export function parseSource(rel: string, text: string): ts.SourceFile {
  const sourceFile = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKind(rel))
  const checkName = rel.endsWith(".js") ? `${rel}x` : rel
  const { diagnostics = [] } = ts.transpileModule(text, {
    fileName: checkName,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve, allowJs: true, target: ts.ScriptTarget.Latest },
  })
  const first = diagnostics.find((d) => d.category === ts.DiagnosticCategory.Error && d.start !== undefined)
  if (first) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(first.start!)
    const message = ts.flattenDiagnosticMessageText(first.messageText, " ")
    throw new UnsupportedInputError("parse-error", `cannot parse ${rel}:${line + 1}: ${message}`)
  }
  return sourceFile
}

export function lineOf(node: ts.Node): number {
  return node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1
}
