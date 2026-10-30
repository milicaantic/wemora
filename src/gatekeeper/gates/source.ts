// Zajedničko za kapije: spisak fajlova nacrta i čitanje koda TypeScript parserom (D-007).
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { extname, join, relative } from "node:path"
import ts from "typescript"

const CODE = new Set([".ts", ".tsx", ".js", ".jsx"])

/** Svi fajlovi sa kodom ispod `dir` (apsolutne putanje, sortirano). */
export function codeFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules") continue
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (CODE.has(extname(e.name))) out.push(p)
    }
  }
  walk(dir)
  return out.sort()
}

export function scriptKind(file: string): ts.ScriptKind {
  const ext = extname(file)
  if (ext === ".tsx") return ts.ScriptKind.TSX
  if (ext === ".jsx") return ts.ScriptKind.JSX
  if (ext === ".js") return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

export function parseFile(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, scriptKind(file))
}

/** Putanja za poruku builderu: relativna u odnosu na nacrt, uvek sa "/". */
export function shown(base: string, file: string): string {
  return relative(base, file).split("\\").join("/")
}

export function lineOf(sf: ts.SourceFile, node: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

export function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}
