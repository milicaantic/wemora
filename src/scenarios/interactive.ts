import { chromium } from "playwright"
import type { ExtractInteractive, InteractiveElement } from "../contracts"
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
export const extractInteractive: ExtractInteractive = async (url, route) => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: DESKTOP })
    await page.goto(`${url.replace(/\/+$/, "")}/${route.replace(/^\/+/, "")}`, { timeout: LOAD_TIMEOUT_MS })
    await page.waitForLoadState("networkidle", { timeout: LOAD_TIMEOUT_MS })
    const main = page.getByRole("main")
    const root = (await main.count()) === 1 ? main : page.locator("body")
    return interactiveElements(parseAriaSnapshot(await root.ariaSnapshot()))
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
