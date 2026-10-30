import type { ParsedApp } from "../contracts"
import { findPart } from "./fileAccess"

const quoteList = (items: string[]) => (items.length > 0 ? items.map((x) => `"${x}"`).join(", ") : "none")

/**
 * The task message for one analyzer: which routes are its own and which files it may read.
 * Only facts from the parser; how to analyze is in prompts/analyzer.md. File contents are not
 * included, the model reads them with its tools.
 */
export function analyzerBrief(parsed: ParsedApp, partId: string): string {
  const part = findPart(parsed, partId)
  const routes = parsed.routes.filter((r) => part.routes.includes(r.path))

  const lines = [
    `Analyze part "${part.id}" of a React web app: ${routes.length} ${routes.length === 1 ? "route" : "routes"}, about ${part.tokens} tokens of screen code.`,
    "",
    "Routes in your part:",
    ...routes.map(
      (r) =>
        `- route "${r.path}": screen component in "${r.file}" (${r.tokens} tokens)\n` +
        `  files: ${quoteList(r.files)}\n` +
        `  web APIs found by the parser: ${quoteList(r.webApis)}`,
    ),
    "",
    `Shared files (used by several screens or by the app shell; read them when a screen depends on them): ${quoteList(parsed.sharedFiles)}`,
    "",
    `Return exactly one report per route above (${routes.length} in total), with "route" written exactly as above.`,
  ]
  return lines.join("\n")
}
