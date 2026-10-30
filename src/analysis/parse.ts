import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import { ParsedAppSchema, type AnalysisPart, type ParseApp, type ParsedRoute } from "../contracts"
import { UnsupportedInputError } from "./errors"
import { closure, collectModuleInfo, resolveSpec, type ModuleInfo } from "./imports"
import { findRoutes, type FoundRoute } from "./routes"
import { estimateTokens, listCodeFiles, parseSource, readText, sourceRoot } from "./source"
import { findWebApis } from "./webApis"

// Only the fields the parser reads; everything else in package.json is ignored.
const PackageJsonSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
})

const ENTRY_NAMES = ["main", "index"]

function checkPackage(webDir: string): void {
  const file = path.join(webDir, "package.json")
  if (!existsSync(file)) throw new UnsupportedInputError("not-react", `no package.json in ${webDir}`)
  let parsed: z.infer<typeof PackageJsonSchema>
  try {
    parsed = PackageJsonSchema.parse(JSON.parse(readFileSync(file, "utf8")))
  } catch (error) {
    throw new UnsupportedInputError("not-react", `package.json in ${webDir} is not valid: ${(error as Error).message}`)
  }
  const deps = { ...parsed.devDependencies, ...parsed.dependencies }
  if (deps.next) {
    throw new UnsupportedInputError("nextjs", "Next.js is not supported: Wemora migrates client-side React SPAs that use React Router 6 or 7.")
  }
  if (!deps.react) throw new UnsupportedInputError("not-react", "package.json has no `react` dependency: only React apps are supported.")
  const router = deps["react-router-dom"] ?? deps["react-router"]
  if (!router) {
    throw new UnsupportedInputError("no-router", "package.json has no `react-router-dom` or `react-router`: Wemora needs React Router 6 or 7 routes.")
  }
  const major = Number(/(\d+)/.exec(router)?.[1])
  if (Number.isFinite(major) && major < 6) {
    throw new UnsupportedInputError("router-v5", `React Router ${router} is not supported: use React Router 6 or 7.`)
  }
}

type Project = {
  files: string[]
  info: Map<string, ModuleInfo>
  /** file → local files it imports (code and CSS). */
  graph: Map<string, string[]>
  webApis: Map<string, string[]>
  routes: FoundRoute[]
}

function loadProject(webDir: string): Project {
  const files = listCodeFiles(webDir, sourceRoot(webDir))
  const info = new Map<string, ModuleInfo>()
  const graph = new Map<string, string[]>()
  const webApis = new Map<string, string[]>()
  const routes: FoundRoute[] = []

  for (const file of files) {
    const sourceFile = parseSource(file, readText(webDir, file))
    const moduleInfo = collectModuleInfo(sourceFile)
    info.set(file, moduleInfo)
    const deps = moduleInfo.specs.map((spec) => resolveSpec(webDir, file, spec)).filter((d): d is string => d !== null)
    graph.set(file, [...new Set(deps)].sort())
    webApis.set(file, findWebApis(sourceFile))
    routes.push(...findRoutes(sourceFile, file))
  }
  return { files, info, graph, webApis, routes }
}

/** The file that holds the component a route renders. */
function resolveTarget(webDir: string, project: Project, route: FoundRoute): string | null {
  const target = route.target
  if (target.kind === "module") return resolveSpec(webDir, route.definedIn, target.spec)
  if (target.kind !== "component") return null
  const binding = project.info.get(route.definedIn)?.bindings.get(target.name)
  if (!binding) return null
  return binding.kind === "local" ? route.definedIn : resolveSpec(webDir, route.definedIn, binding.spec)
}

const describe = (r: FoundRoute) => `route "${r.path}" in ${r.definedIn}:${r.line}`

export const parseApp: ParseApp = async (webDir) => {
  const root = path.resolve(webDir)
  checkPackage(root)
  const project = loadProject(root)

  // Screens are leaf routes; parent routes with an element are layouts and count as shared code.
  const screens: { path: string; file: string }[] = []
  const layoutFiles: string[] = []
  for (const route of project.routes) {
    if (route.target.kind === "redirect") continue
    if (route.isLayout) {
      if (route.target.kind === "none") continue
      const file = resolveTarget(root, project, route)
      if (!file) throw new UnsupportedInputError("unresolved-route", `${describe(route)}: cannot find the file of its layout element`)
      layoutFiles.push(file)
      continue
    }
    if (route.target.kind === "none") continue
    const file = resolveTarget(root, project, route)
    if (!file) {
      const what = route.target.kind === "component" ? `component "${route.target.name}"` : "its element"
      throw new UnsupportedInputError("unresolved-route", `${describe(route)}: cannot find the file of ${what}`)
    }
    screens.push({ path: route.path, file })
  }
  if (screens.length === 0) {
    throw new UnsupportedInputError("no-routes", "no React Router routes with an element were found (looked for <Route> and createBrowserRouter/useRoutes)")
  }
  const duplicate = screens.find((s, i) => screens.findIndex((t) => t.path === s.path) !== i)
  if (duplicate) throw new UnsupportedInputError("unresolved-route", `route "${duplicate.path}" is declared more than once`)

  // Roots: the entry file, files that declare routes, and layouts. They are shared by definition.
  const sourceDir = path.relative(root, sourceRoot(root)).split(path.sep).join("/")
  const entries = project.files.filter((f) => {
    const dir = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : ""
    return dir === sourceDir && ENTRY_NAMES.includes(path.posix.basename(f).replace(/\.[jt]sx?$/, ""))
  })
  const roots = new Set([...entries, ...project.routes.map((r) => r.definedIn), ...layoutFiles])

  // A screen declared inside a root file (e.g. a component in App.jsx) owns no files of its own;
  // following its imports would pull every page in as "shared".
  const screenFiles = new Set(screens.map((s) => s.file))
  const reach = new Map([...screenFiles].map((f) => [f, roots.has(f) ? new Set([f]) : closure([f], project.graph)]))
  const useCount = new Map<string, number>()
  for (const files of reach.values()) for (const f of files) useCount.set(f, (useCount.get(f) ?? 0) + 1)

  // Shared code: everything reached from the roots without entering screen files, plus files used by 2+ screens.
  const stopAt = new Set([...screenFiles].filter((f) => !roots.has(f)))
  const shared = closure([...roots], project.graph, stopAt)
  for (const [file, count] of useCount) if (count >= 2) shared.add(file)

  const tokensOf = new Map<string, number>()
  const tokens = (file: string) => {
    if (!tokensOf.has(file)) tokensOf.set(file, estimateTokens(readText(root, file)))
    return tokensOf.get(file)!
  }

  const routes: ParsedRoute[] = screens
    .map(({ path: routePath, file }) => {
      const files = [...reach.get(file)!].filter((f) => !shared.has(f)).sort()
      const webApis = [...new Set(files.flatMap((f) => project.webApis.get(f) ?? []))].sort()
      return { path: routePath, file, files, tokens: files.reduce((sum, f) => sum + tokens(f), 0), webApis }
    })
    .sort((a, b) => a.path.localeCompare(b.path))

  const sharedFiles = [...shared].sort()
  const allFiles = new Set([...sharedFiles, ...routes.flatMap((r) => r.files)])
  const totalTokens = [...allFiles].reduce((sum, f) => sum + tokens(f), 0)

  // One part with everything; the Conductor re-splits with splitParts(parsed, n) (D7).
  const parts: AnalysisPart[] = [
    {
      id: "part-1",
      routes: routes.map((r) => r.path),
      files: [...new Set(routes.flatMap((r) => r.files))].sort(),
      tokens: routes.reduce((sum, r) => sum + r.tokens, 0),
    },
  ]

  return ParsedAppSchema.parse({ webDir: root, routes, sharedFiles, totalTokens, parts })
}
