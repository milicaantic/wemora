import { chromium, type Page } from "playwright"
import type { ExtractInteractive, InteractiveElement, Step } from "../contracts"
import { snapshotAfterSteps } from "./run"
import { matchesRoute } from "./tester"
import { DESKTOP } from "./viewports"

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "checkbox",
  "radio",
  "combobox",
  "switch",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "slider",
  "spinbutton",
])

// Rows of a table or list repeat the same controls for each item of data; only the first one counts.
const REPEATED_ROLES = new Set(["row", "listitem"])

const LOAD_TIMEOUT_MS = 15_000

/**
 * Lists the named interactive elements a user can reach on one screen of the original (desktop viewport),
 * in document order, without duplicates. Only the `main` landmark is read when the page has one, so shared
 * navigation is not counted on every screen. Unnamed elements are skipped: tests address elements by name.
 */
export const extractInteractive: ExtractInteractive = (url, route) =>
  onLoadedPage(url, route, async (page) => {
    const main = page.getByRole("main")
    const root = (await main.count()) === 1 ? main : page.locator("body")
    return interactiveElements(parseAriaSnapshot(await root.ariaSnapshot()))
  })

/**
 * What a user sees on one screen of the original (desktop viewport), as Playwright's ARIA snapshot YAML.
 * With `steps`, they run after opening the route, so the snapshot shows what appears only after a tap.
 */
export function ariaSnapshot(url: string, route: string, steps: Step[] = []): Promise<string> {
  if (steps.length > 0) return snapshotAfterSteps(url, [{ goto: route }, ...steps])
  return onLoadedPage(url, route, (page) => page.locator("body").ariaSnapshot())
}

/** A named link on a screen of the original and the path it opens (same origin only). */
export type LinkTarget = { name: string; path: string }

/** The named links on one screen of the original (desktop viewport) and the path each one opens. */
export function linkTargets(url: string, route: string): Promise<LinkTarget[]> {
  return onLoadedPage(url, route, (page) => readLinks(page))
}

/**
 * A real path for a route with parameters (/recepti/:id): the first link on these screens that opens it, e.g.
 * /recepti/1 from the recipe list. Null when no screen links to it.
 */
export async function findOpenPath(url: string, route: string, from: string[]): Promise<string | null> {
  for (const start of from) {
    const found = (await onLoadedPage(url, start, (page) => readLinks(page)).catch(() => [])).find((l) => matchesRoute(route, l.path))
    if (found) return found.path
  }
  return null
}

async function readLinks(page: Page): Promise<LinkTarget[]> {
  const origin = new URL(page.url()).origin
  const links = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors.map((a) => ({
      // The accessible name of a link: aria-label when set, else its text (what getByRole matches by name).
      name: (a.getAttribute("aria-label") ?? a.textContent ?? "").replace(/\s+/g, " ").trim(),
      // The resolved absolute URL (the DOM property, not the attribute); the root tsconfig has no DOM types.
      href: (a as unknown as { href: string }).href,
    })),
  )
  return links.flatMap(({ name, href }) => {
    const target = new URL(href)
    return name !== "" && target.origin === origin ? [{ name, path: `${target.pathname}${target.hash}` }] : []
  })
}

async function onLoadedPage<T>(url: string, route: string, read: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: DESKTOP })
    await page.goto(`${url.replace(/\/+$/, "")}/${route.replace(/^\/+/, "")}`, { timeout: LOAD_TIMEOUT_MS })
    await page.waitForLoadState("networkidle", { timeout: LOAD_TIMEOUT_MS })
    return await read(page)
  } finally {
    await browser.close().catch(() => {})
  }
}

export type AriaNode = { role: string; name: string | null; children: AriaNode[] }

/** Parses the YAML text from Playwright's `ariaSnapshot()` into a tree (only the parts we need). */
export function parseAriaSnapshot(yaml: string): AriaNode[] {
  const roots: AriaNode[] = []
  const stack: { indent: number; node: AriaNode }[] = []
  for (const line of yaml.split("\n")) {
    const match = /^(\s*)- (.*)$/.exec(line)
    if (!match) continue
    const key = entryKey(match[2])
    const parsed = key && /^([a-z]+)(?: "((?:[^"\\]|\\.)*)")?(?: \[.*\])?$/.exec(key)
    if (!parsed) continue

    const node: AriaNode = { role: parsed[1], name: parsed[2] === undefined ? null : JSON.parse(`"${parsed[2]}"`), children: [] }
    const indent = match[1].length
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop()
    ;(stack.length > 0 ? stack[stack.length - 1].node.children : roots).push(node)
    stack.push({ indent, node })
  }
  return roots
}

export function interactiveElements(nodes: AriaNode[]): InteractiveElement[] {
  const found = new Map<string, InteractiveElement>()
  const visit = (list: AriaNode[]) => {
    let firstRowSeen = false
    for (const node of list) {
      if (REPEATED_ROLES.has(node.role)) {
        if (firstRowSeen) continue
        if (!hasInteractive(node)) continue
        firstRowSeen = true
      }
      if (INTERACTIVE_ROLES.has(node.role) && node.name) {
        const key = `${node.role}\u0000${node.name}`
        if (!found.has(key)) found.set(key, { role: node.role, name: node.name })
      }
      visit(node.children)
    }
  }
  visit(nodes)
  return [...found.values()]
}

function hasInteractive(node: AriaNode): boolean {
  return node.children.some((c) => (INTERACTIVE_ROLES.has(c.role) && c.name !== null) || hasInteractive(c))
}

// The key of a YAML entry: `role "name" [attrs]`, possibly single-quoted when it contains ": ".
function entryKey(entry: string): string | null {
  if (entry.startsWith("'")) {
    let key = ""
    for (let i = 1; i < entry.length; i++) {
      if (entry[i] !== "'") key += entry[i]
      else if (entry[i + 1] === "'") key += entry[++i]
      else return key
    }
    return null
  }
  const colon = entry.search(/:( |$)/)
  return colon === -1 ? entry : entry.slice(0, colon)
}
