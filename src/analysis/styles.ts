import { existsSync } from "node:fs"
import path from "node:path"
import type { ParsedApp } from "../contracts"
import { estimateTokens, readText } from "./source"

// Global styles for the shared unit "theme" (D-027, inbox C → D): the stylesheets that set fonts,
// sizes and colors for the whole app. Two kinds:
// - CSS files among the shared files with rules for whole elements (body, html, :root, *, a, button, h1…);
// - CSS from packages that shared code imports, e.g. `import "todomvc-app-css/index.css"` in src/index.js.
// Package CSS is found from the import statements, not from node_modules, so the result is the same
// whether the example app is installed or not.

const CODE_FILE = /\.[jt]sx?$/
const PACKAGE_CSS = /(?:\bimport\s*|\brequire\s*\(\s*)["']([^"'./][^"']*\.css)["']/g
const GLOBAL_ELEMENT = /^(html|body|:root|\*|a|button|input|select|textarea|h[1-6]|p|ul|ol|li|table)(?=$|:|\[)/

const read = (parsed: ParsedApp, file: string): string | null => {
  try {
    return readText(parsed.webDir, file)
  } catch {
    return null
  }
}

/** `node_modules/<package path>.css` for every package stylesheet that shared code imports, sorted. */
export function packageStylesheets(parsed: ParsedApp): string[] {
  const found = new Set<string>()
  for (const file of parsed.sharedFiles.filter((f) => CODE_FILE.test(f))) {
    const code = read(parsed, file)
    if (code === null) continue
    for (const match of code.matchAll(PACKAGE_CSS)) found.add(`node_modules/${match[1]}`)
  }
  return [...found].sort()
}

/** True when a stylesheet has a rule for a whole element (`body {`, `a, button {`, `h1:hover {`). */
export function hasGlobalRules(css: string): boolean {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "")
  for (const match of plain.matchAll(/([^{}]+)\{/g)) {
    const selectors = match[1]!.trim()
    if (selectors.startsWith("@")) continue
    if (selectors.split(",").some((s) => GLOBAL_ELEMENT.test(s.trim()))) return true
  }
  return false
}

/** The stylesheets a theme unit should own: shared CSS with global rules, then package CSS. */
export function globalStylesheets(parsed: ParsedApp): string[] {
  const own = parsed.sharedFiles.filter((f) => f.endsWith(".css") && hasGlobalRules(read(parsed, f) ?? ""))
  return [...new Set([...own.sort(), ...packageStylesheets(parsed)])]
}

/** Every path a unit may list in `sources`: the parser's files plus package stylesheets. */
export function knownSourceFiles(parsed: ParsedApp): Set<string> {
  return new Set([...parsed.sharedFiles, ...parsed.routes.flatMap((r) => r.files), ...packageStylesheets(parsed)])
}

/** Tokens of a source; 0 for a package stylesheet that is not installed. */
export function sourceTokens(parsed: ParsedApp, file: string): number {
  if (!existsSync(path.join(parsed.webDir, file))) return 0
  return estimateTokens(read(parsed, file) ?? "")
}
