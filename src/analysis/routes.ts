import ts from "typescript"
import { lazyImportSpec } from "./imports"
import { lineOf } from "./source"

/** What a route renders. */
export type RouteTarget =
  | { kind: "component"; name: string }
  | { kind: "module"; spec: string } // object route with `lazy: () => import("./x")`
  | { kind: "redirect" }
  | { kind: "none" }
  | { kind: "unknown"; text: string }

export type FoundRoute = {
  /** Full path after joining with parents: "/recepti/:id", "/", "*". */
  path: string
  target: RouteTarget
  /** True when the route has child routes; it is then a layout, not a screen. */
  isLayout: boolean
  definedIn: string
  line: number
}

const ROUTER_FACTORIES = new Set(["createBrowserRouter", "createHashRouter", "createMemoryRouter", "useRoutes"])
const WRAPPERS = new Set(["Suspense", "StrictMode"])

/** Joins a child path onto its parent the way React Router does. */
export function joinPath(parent: string, child: string | undefined): string {
  if (child === undefined || child === "") return parent
  const joined = child.startsWith("/") ? child : `${parent.replace(/\/+$/, "")}/${child}`
  return normalizePath(joined)
}

export function normalizePath(p: string): string {
  const collapsed = `/${p}`.replace(/\/{2,}/g, "/")
  const trimmed = collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed
  // A catch-all at the top level stays "*", as React Router writes it.
  return trimmed === "/*" ? "*" : trimmed
}

function tagName(node: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return `${tagName(node.expression as ts.JsxTagNameExpression)}.${node.name.text}`
  return node.getText()
}

const lastSegment = (name: string) => name.split(".").pop()!

type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement

const opening = (el: JsxNode) => (ts.isJsxElement(el) ? el.openingElement : el)
const isJsxNode = (n: ts.Node): n is JsxNode => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)
const isRouteElement = (n: ts.Node): n is JsxNode => isJsxNode(n) && lastSegment(tagName(opening(n).tagName)) === "Route"

function unwrapExpression(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e)) e = e.expression
  return e
}

/** What a JSX element like `<Page />` or `<Suspense><Page /></Suspense>` renders. */
function targetOfJsx(expr: ts.Expression): RouteTarget {
  const e = unwrapExpression(expr)
  if (!isJsxNode(e)) return { kind: "unknown", text: e.getText() }
  const name = tagName(opening(e).tagName)
  if (lastSegment(name) === "Navigate") return { kind: "redirect" }
  if (WRAPPERS.has(lastSegment(name)) && ts.isJsxElement(e)) {
    const child = e.children.find(isJsxNode)
    if (child) return targetOfJsx(child)
  }
  return /^[A-Z]/.test(lastSegment(name)) && !name.includes(".")
    ? { kind: "component", name }
    : { kind: "unknown", text: name }
}

// JSX <Route>

function jsxAttribute(el: JsxNode, name: string): ts.JsxAttribute | undefined {
  return opening(el).attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name,
  )
}

function jsxStringValue(attr: ts.JsxAttribute | undefined): string | undefined {
  const init = attr?.initializer
  if (!init) return undefined
  if (ts.isStringLiteral(init)) return init.text
  if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) return init.expression.text
  return undefined
}

function jsxIsTrue(attr: ts.JsxAttribute | undefined): boolean {
  if (!attr) return false
  const init = attr.initializer
  return !init || (ts.isJsxExpression(init) && init.expression?.kind === ts.SyntaxKind.TrueKeyword)
}

/** Direct child <Route> elements, looking through fragments. */
function childRoutes(el: JsxNode): JsxNode[] {
  if (!ts.isJsxElement(el)) return []
  const out: JsxNode[] = []
  const scan = (children: ts.NodeArray<ts.JsxChild>) => {
    for (const child of children) {
      if (isRouteElement(child)) out.push(child)
      else if (ts.isJsxFragment(child)) scan(child.children)
    }
  }
  scan(el.children)
  return out
}

function jsxTarget(el: JsxNode): RouteTarget {
  const element = jsxAttribute(el, "element")?.initializer
  if (element && ts.isJsxExpression(element) && element.expression) return targetOfJsx(element.expression)
  const component = jsxAttribute(el, "Component")?.initializer
  if (component && ts.isJsxExpression(component) && component.expression && ts.isIdentifier(component.expression)) {
    return { kind: "component", name: component.expression.text }
  }
  return { kind: "none" }
}

function walkJsxRoute(el: JsxNode, parent: string, file: string, out: FoundRoute[]): void {
  const index = jsxIsTrue(jsxAttribute(el, "index"))
  const fullPath = index ? parent || "/" : joinPath(parent || "/", jsxStringValue(jsxAttribute(el, "path")))
  const children = childRoutes(el)
  out.push({ path: fullPath, target: jsxTarget(el), isLayout: children.length > 0, definedIn: file, line: lineOf(el) })
  for (const child of children) walkJsxRoute(child, fullPath, file, out)
}

// Object routes: createBrowserRouter([...]), useRoutes([...])

/** The value of `name` in an object literal: an expression, or the method itself for `lazy() {}`. */
function objectProperty(obj: ts.ObjectLiteralExpression, name: string): ts.Node | undefined {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText().replace(/["']/g, "") === name) return p.initializer
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === name) return p.name
    if (ts.isMethodDeclaration(p) && p.name.getText() === name) return p
  }
  return undefined
}

function objectTarget(obj: ts.ObjectLiteralExpression): RouteTarget {
  const element = objectProperty(obj, "element")
  if (element && !ts.isMethodDeclaration(element)) return targetOfJsx(element as ts.Expression)
  const component = objectProperty(obj, "Component")
  if (component && ts.isIdentifier(component)) return { kind: "component", name: component.text }
  const lazy = objectProperty(obj, "lazy")
  const spec = lazy ? lazyImportSpec(lazy) : null
  if (spec) return { kind: "module", spec }
  return { kind: "none" }
}

function walkObjectRoutes(array: ts.ArrayLiteralExpression, parent: string, file: string, out: FoundRoute[]): void {
  for (const item of array.elements) {
    const obj = unwrapExpression(item as ts.Expression)
    if (!ts.isObjectLiteralExpression(obj)) continue
    const indexValue = objectProperty(obj, "index")
    const index = indexValue?.kind === ts.SyntaxKind.TrueKeyword
    const pathValue = objectProperty(obj, "path")
    const pathText = pathValue && ts.isStringLiteralLike(pathValue) ? pathValue.text : undefined
    const fullPath = index ? parent || "/" : joinPath(parent || "/", pathText)
    const childrenValue = objectProperty(obj, "children")
    const children = childrenValue && ts.isArrayLiteralExpression(childrenValue) ? childrenValue : null
    out.push({
      path: fullPath,
      target: objectTarget(obj),
      isLayout: children !== null && children.elements.length > 0,
      definedIn: file,
      line: lineOf(obj),
    })
    if (children) walkObjectRoutes(children, fullPath, file, out)
  }
}

/** All routes declared in one file. Nested <Routes> inside screen components are not followed. */
export function findRoutes(sourceFile: ts.SourceFile, file: string): FoundRoute[] {
  const out: FoundRoute[] = []
  const visit = (node: ts.Node) => {
    if (isRouteElement(node)) {
      walkJsxRoute(node, "", file, out)
      return // children are handled by walkJsxRoute
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : ""
      const first = node.arguments[0] ? unwrapExpression(node.arguments[0]) : undefined
      if (ROUTER_FACTORIES.has(name) && first && ts.isArrayLiteralExpression(first)) {
        walkObjectRoutes(first, "", file, out)
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return out
}
