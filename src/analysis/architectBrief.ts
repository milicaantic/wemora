import type { AnalyzerReport, ParsedApp } from "../contracts"

const quoteList = (items: string[]) => (items.length > 0 ? items.map((x) => `"${x}"`).join(", ") : "none")
const isFallback = (r: AnalyzerReport) => r.summary.startsWith("Automatic fallback")

/**
 * The task message for the architect: the parser's facts and every analyzer report.
 * How to build a plan is in prompts/architect.md; this message only carries this app's data.
 */
export function architectBrief(parsed: ParsedApp, reports: AnalyzerReport[]): string {
  const sortedReports = [...reports].sort((a, b) => a.route.localeCompare(b.route) || a.partId.localeCompare(b.partId))
  const fallbacks = sortedReports.filter(isFallback).map((r) => r.route)

  const lines = [
    `Make a migration plan for a React web app with ${parsed.routes.length} ${parsed.routes.length === 1 ? "route" : "routes"} (about ${parsed.totalTokens} tokens of code).`,
    "",
    "Routes found by the parser (each needs exactly one screen unit):",
    ...parsed.routes.map(
      (r) =>
        `- route "${r.path}": screen component "${r.file}"\n` +
        `  files of this screen: ${quoteList(r.files)}\n` +
        `  web APIs: ${quoteList(r.webApis)}`,
    ),
    "",
    `Shared files (used by several screens or by the app shell; put them in shared units): ${quoteList(parsed.sharedFiles)}`,
    "",
    "Use these file paths exactly as written. A file may belong to at most one unit.",
    "",
    `Analyzer reports (${sortedReports.length}):`,
    "```json",
    JSON.stringify(sortedReports, null, 2),
    "```",
  ]
  if (fallbacks.length > 0) {
    lines.push(
      "",
      `The reports for ${quoteList(fallbacks)} are automatic fallbacks with no analysis. Read their file lists and web APIs, and write the obligations from the route and file names.`,
    )
  }
  return lines.join("\n")
}

/**
 * The message for a new attempt after validatePlan found problems. Each attempt runs in a fresh
 * context, so the message repeats the brief, then the problems, then the previous plan.
 */
export function architectRetryMessage(brief: string, previous: unknown, errors: string[]): string {
  return [
    brief,
    "",
    `Your previous plan has ${errors.length} ${errors.length === 1 ? "problem" : "problems"}:`,
    ...errors.map((e, i) => `${i + 1}. ${e}`),
    "",
    "Previous plan:",
    "```json",
    JSON.stringify(previous, null, 2),
    "```",
    "",
    "Return the full corrected plan, not only the changed parts.",
  ].join("\n")
}
