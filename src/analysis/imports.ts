import { existsSync, statSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { CODE_EXTENSIONS, toPosix } from "./source"

/** A local name bound by `import`, by `lazy(() => import(...))`, or declared in the file itself. */
export type Binding = { kind: "import"; spec: string } | { kind: "local" }

export type ModuleInfo = {
  /** Every module specifier the file depends on (static, re-export, dynamic import, require). */
  specs: string[]
  bindings: Map<string, Binding>
}

/** Returns the specifier of `import("x")`, or null. */
export function dynamicImportSpec(node: ts.Node): string | null {
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments[0] &&
    ts.isStringLiteralLike(node.arguments[0])
  ) {
    return node.arguments[0].text
  }
  return null
}

/** The `import("x")` inside `() => import("x")`, `() => { return import("x") }` or `lazy() { ... }`. */
export function lazyImportSpec(fn: ts.Node): string | null {
  if (!(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn)) || !fn.body) return null
  let found: string | null = null
  const visit = (n: ts.Node) => {
    found ??= dynamicImportSpec(n)
    if (!found) ts.forEachChild(n, visit)
  }
  visit(fn.body)
  return found
}

function isLazyCall(node: ts.Expression): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false
  const callee = node.expression
  return (
    (ts.isIdentifier(callee) && callee.text === "lazy") ||
    (ts.isPropertyAccessExpression(callee) && callee.name.text === "lazy")
  )
}

export function collectModuleInfo(sourceFile: ts.SourceFile): ModuleInfo {
  const specs: string[] = []
  const bindings = new Map<string, Binding>()

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const spec = statement.moduleSpecifier.text
      const clause = statement.importClause
      if (clause?.name) bindings.set(clause.name.text, { kind: "import", spec })
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) bindings.set(element.name.text, { kind: "import", spec })
      }
    } else if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) bindings.set(statement.name.text, { kind: "local" })
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue
        const init = declaration.initializer
        const spec = init && isLazyCall(init) && init.arguments[0] ? lazyImportSpec(init.arguments[0]) : null
        bindings.set(declaration.name.text, spec ? { kind: "import", spec } : { kind: "local" })
      }
    }
  }

  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) specs.push(node.moduleSpecifier.text)
    }
    const dynamic = dynamicImportSpec(node)
    if (dynamic) specs.push(dynamic)
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return { specs, bindings }
}

const isFile = (abs: string) => existsSync(abs) && statSync(abs).isFile()

/**
 * Resolves a relative specifier to a project file (relative to webDir, posix).
 * Package imports and files outside webDir return null.
 */
export function resolveSpec(webDir: string, fromRel: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null
  const base = path.resolve(webDir, path.dirname(fromRel), spec)
  const candidates = [
    base,
    ...CODE_EXTENSIONS.map((ext) => base + ext),
    ...CODE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ]
  const hit = candidates.find(isFile)
  if (!hit) return null
  const rel = toPosix(path.relative(webDir, hit))
  return rel.startsWith("..") ? null : rel
}

/**
 * Every file reachable from `starts` through the import graph, including the starts.
 * The walk does not enter `stopAt` files (they are neither included nor followed).
 */
export function closure(starts: string[], graph: Map<string, string[]>, stopAt: ReadonlySet<string> = new Set()): Set<string> {
  const seen = new Set<string>()
  const queue = starts.filter((s) => !stopAt.has(s))
  while (queue.length > 0) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const next of graph.get(file) ?? []) if (!seen.has(next) && !stopAt.has(next)) queue.push(next)
  }
  return seen
}
